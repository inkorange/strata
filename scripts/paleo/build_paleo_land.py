#!/usr/bin/env python3
"""Generate per-era paleoshoreline land polygons for the Strata tectonics viewer.

Past eras: threshold the Scotese & Wright (2018) PaleoDEM at sea level and
polygonize the land. Future era: extrapolate present coastlines forward 50 My
via plate stage rotations (pyGPlates). Output: src/tectonics/paleoLand.generated.json

Data: Scotese, C.R., Wright, N. (2018). PALEOMAP PaleoDEMs, Zenodo,
doi:10.5281/zenodo.5460860 (CC-BY-4.0).
Rotations for the future projection: Muller et al. (2019) via gplately (CC-BY).

Run: python3 scripts/paleo/build_paleo_land.py
Requires: pip install --user numpy xarray netCDF4 matplotlib shapely gplately pygplates
"""
import os, re, json, zipfile, urllib.request, warnings

warnings.filterwarnings("ignore")
import numpy as np  # noqa: F401  (xarray backend)
import xarray as xr
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from shapely.geometry import Polygon
from shapely.ops import unary_union

CACHE = os.path.join(os.path.dirname(__file__), "_cache")
OUT = os.path.join(
    os.path.dirname(__file__), "..", "..", "src", "tectonics", "paleoLand.generated.json"
)
DEM_ZIP_URL = (
    "https://zenodo.org/records/5460860/files/"
    "Scotese_Wright_2018_Maps_1-88_1degX1deg_PaleoDEMS_nc.zip?download=1"
)

# Era id -> target age (Ma). Past eras read the DEM; 'future' is projected.
PAST_AGES = {
    "pangaea": 250,
    "late-jurassic": 150,
    "late-cretaceous": 90,
    "eocene": 50,
    "present": 0,
}
FUTURE_ID, FUTURE_AGE = "future", -50

SEA_LEVEL = 0.0  # elevation threshold (m) for land
MIN_AREA_DEG2 = 2.0  # drop islands smaller than this (deg^2) to keep it light
SIMPLIFY_TOL = 0.7  # Douglas-Peucker tolerance (degrees)


def _download_dem():
    os.makedirs(CACHE, exist_ok=True)
    zpath = os.path.join(CACHE, "paleodem_1deg.zip")
    if not os.path.exists(zpath):
        print("downloading PaleoDEM (CC-BY) ...", flush=True)
        urllib.request.urlretrieve(DEM_ZIP_URL, zpath)
    return zipfile.ZipFile(zpath)


def _nc_for_age(zf, age):
    ncs = [n for n in zf.namelist() if n.endswith(".nc")]

    def a(n):
        m = re.findall(r"(\d+)Ma", n)
        return int(m[-1]) if m else None

    cand = [(a(n), n) for n in ncs if a(n) is not None]
    return min(cand, key=lambda t: abs(t[0] - age))[1]


def _clean_to_rings(polys):
    """Union overlapping/adjacent polygons, drop tiny ones, simplify, and emit
    closed [lat,lng] rings. Shared by the DEM and future-projection paths so
    both produce clean, deduplicated, lightweight landmasses. Input polygons use
    (lon, lat) coordinates; output rings are [lat, lng]."""
    polys = [p for p in (q.buffer(0) for q in polys) if not p.is_empty]
    if not polys:
        return []
    land = unary_union(polys)
    geoms = list(land.geoms) if land.geom_type == "MultiPolygon" else [land]
    rings = []
    for g in geoms:
        if g.area < MIN_AREA_DEG2:
            continue
        s = g.simplify(SIMPLIFY_TOL, preserve_topology=True)
        if s.is_empty:
            continue
        coords = list(s.exterior.coords)
        ring = [[round(float(y), 2), round(float(x), 2)] for x, y in coords]
        if len(ring) >= 4:
            rings.append(ring)
    return rings


def _rings_from_grid(lon, lat, Z):
    """Return [lat,lng] rings for land (Z >= SEA_LEVEL) via filled-contour polys."""
    cs = plt.contourf(lon, lat, Z, levels=[SEA_LEVEL, 1e9])
    polys = []
    for p in cs.get_paths():
        for ring in p.to_polygons():
            if len(ring) >= 4:
                poly = Polygon(ring)
                if poly.is_valid and poly.area > 0:
                    polys.append(poly)
    plt.close("all")
    return _clean_to_rings(polys)


def _land_from_dem(zf, age):
    name = _nc_for_age(zf, age)
    print(f"  age {age} Ma -> {name.split('/')[-1]}", flush=True)
    zf.extract(name, CACHE)
    ds = xr.open_dataset(os.path.join(CACHE, name))
    var = list(ds.data_vars)[0]
    latname = [c for c in ds.coords if "lat" in c.lower()][0]
    lonname = [c for c in ds.coords if "lon" in c.lower()][0]
    return _rings_from_grid(ds[lonname].values, ds[latname].values, ds[var].values)


def _future_land(present_rings):
    """Project present-day land rings forward 50 My by plate stage rotation."""
    import gplately
    import pygplates

    gd = gplately.DataServer("Muller2019")
    rot, _topo, static = gd.get_plate_reconstruction_files()
    moved_polys = []
    for ring in present_rings:
        pts = [pygplates.PointOnSphere(lat, lng) for lat, lng in ring]
        if len(pts) < 4:
            continue
        feat = pygplates.Feature()
        feat.set_geometry(pygplates.PolygonOnSphere(pts))
        partitioned = pygplates.partition_into_plates(static, rot, [feat])
        for pf in partitioned:
            pid = pf.get_reconstruction_plate_id()
            stage = rot.get_rotation(0, pid, 1)  # 1 Ma -> 0 Ma finite rotation
            pole, angle = stage.get_euler_pole_and_angle()
            fwd = pygplates.FiniteRotation(pole, angle * 50.0)  # extrapolate +50 My
            # A partitioned feature can hold zero-or-many geometries; iterate all.
            for geom in pf.get_all_geometries():
                if geom is None:
                    continue
                ll = (fwd * geom).to_lat_lon_list()  # [(lat,lng),...]
                if len(ll) >= 4:
                    moved_polys.append(Polygon([(lo, la) for la, lo in ll]))  # (lon,lat)
    # Re-merge the per-plate fragments into clean landmasses (dedupe slivers).
    return _clean_to_rings(moved_polys)


def main():
    zf = _download_dem()
    data = {}
    present_rings = None
    for eid, age in PAST_AGES.items():
        rings = _land_from_dem(zf, age)
        data[eid] = rings
        if eid == "present":
            present_rings = rings
        print(
            f"  {eid}: {len(rings)} land polygons, {sum(len(r) for r in rings)} pts",
            flush=True,
        )
    try:
        data[FUTURE_ID] = _future_land(present_rings)
        print(
            f"  future: {len(data[FUTURE_ID])} land polygons (projected +50My)",
            flush=True,
        )
    except Exception as e:
        print(
            f"  future projection failed ({e!r}); reusing present land as placeholder",
            flush=True,
        )
        data[FUTURE_ID] = present_rings
    # Sanity asserts
    for eid in list(PAST_AGES) + [FUTURE_ID]:
        assert eid in data and len(data[eid]) > 0, f"no land for {eid}"
        for ring in data[eid]:
            assert len(ring) >= 4, f"degenerate ring in {eid}"
            for lat, lng in ring:
                assert -90 <= lat <= 90 and -180 <= lng <= 180, f"bad coord in {eid}"
    with open(os.path.abspath(OUT), "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print("wrote", os.path.abspath(OUT), flush=True)


if __name__ == "__main__":
    main()
