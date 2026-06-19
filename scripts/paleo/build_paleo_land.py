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
import numpy as np
import xarray as xr
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
TILE_DEG = 20.0  # split landmasses into <=20deg tiles (see _tile_geom)


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


def _tile_geom(geom):
    """Split a (lon,lat) polygon into <=TILE_DEG tiles by intersecting with a
    lat/lng grid. Planar earcut + sphere projection distorts and sags badly for
    large polygons (e.g. globe-spanning Pangaea); bounding every piece to a small
    cell keeps triangles small so the on-sphere fill stays put. Internal tile
    seams are invisible (adjacent tiles share exact edges, same color)."""
    from shapely.geometry import box

    minx, miny, maxx, maxy = geom.bounds
    pieces = []
    x = TILE_DEG * np.floor(minx / TILE_DEG)
    while x < maxx:
        y = TILE_DEG * np.floor(miny / TILE_DEG)
        while y < maxy:
            cell = box(
                max(-180.0, x), max(-90.0, y), min(180.0, x + TILE_DEG), min(90.0, y + TILE_DEG)
            )
            inter = geom.intersection(cell)
            if not inter.is_empty:
                sub = list(inter.geoms) if inter.geom_type.startswith("Multi") else [inter]
                for g in sub:
                    if g.geom_type == "Polygon" and g.area > 0.05:
                        pieces.append(g)
            y += TILE_DEG
        x += TILE_DEG
    return pieces


def _clean_to_rings(polys):
    """Union overlapping/adjacent polygons, drop tiny ones, simplify, tile, and
    emit closed [lat,lng] rings. Shared by the DEM and future-projection paths.
    Input polygons use (lon, lat); output rings are [lat, lng]."""
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
        for tile in _tile_geom(s):
            coords = list(tile.exterior.coords)
            ring = [[round(float(y), 2), round(float(x), 2)] for x, y in coords]
            if len(ring) >= 4:
                rings.append(ring)
    return rings


def _rings_from_grid(lon, lat, Z):
    """Return [lat,lng] rings for land (Z >= SEA_LEVEL).

    Built by unioning the land grid CELLS (run-length strips per latitude row),
    not by contouring. matplotlib's contourf.to_polygons() shatters and drops
    landmasses that touch the grid boundary / dateline (it lost all of Eurasia
    and North America); cell-union is topology-robust. Coastlines come out
    stair-stepped at grid resolution, then simplified smooth."""
    from shapely.geometry import box

    lon = np.asarray(lon)
    lat = np.asarray(lat)
    Z = np.asarray(Z)
    hx = abs(float(lon[1] - lon[0])) / 2.0
    hy = abs(float(lat[1] - lat[0])) / 2.0
    mask = Z >= SEA_LEVEL  # [nlat, nlon]
    boxes = []
    for j in range(mask.shape[0]):
        row = mask[j]
        i = 0
        n = row.shape[0]
        # Clamp polar/edge cell extents to valid lat/lng (a -90 row would
        # otherwise reach -90.5, an invalid latitude downstream).
        y0 = max(-90.0, lat[j] - hy)
        y1 = min(90.0, lat[j] + hy)
        while i < n:
            if row[i]:
                k = i
                while k + 1 < n and row[k + 1]:
                    k += 1
                x0 = max(-180.0, lon[i] - hx)
                x1 = min(180.0, lon[k] + hx)
                boxes.append(box(x0, y0, x1, y1))
                i = k + 1
            else:
                i += 1
    return _clean_to_rings(boxes)


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
    """Project present-day land forward 50 My so it looks like today's continents
    just shifted. Each present-day land tile is moved RIGIDLY by the plate under
    its centroid (no cookie-cutting at plate boundaries — that shatters
    continents into choppy fragments). Tiles of the same continent share a plate,
    so they move together and stay coherent."""
    import gplately
    import pygplates

    gd = gplately.DataServer("Muller2019")
    rot, _topo, static = gd.get_plate_reconstruction_files()
    partitioner = pygplates.PlatePartitioner(static, rot)  # present-day plates

    fwd_cache = {}

    def fwd_for(pid):
        if pid not in fwd_cache:
            stage = rot.get_rotation(0, pid, 1)  # 1 Ma -> 0 Ma stage rotation
            pole, angle = stage.get_euler_pole_and_angle()
            fwd_cache[pid] = pygplates.FiniteRotation(pole, angle * 50.0)  # +50 My
        return fwd_cache[pid]

    out_rings = []
    for ring in present_rings:
        clat = sum(p[0] for p in ring) / len(ring)
        clng = sum(p[1] for p in ring) / len(ring)
        res = partitioner.partition_point(pygplates.PointOnSphere(clat, clng))
        pid = 0
        if res is not None:
            try:
                pid = res.get_feature().get_reconstruction_plate_id()
            except Exception:
                pid = 0
        fwd = fwd_for(pid)
        moved = []
        for lat, lng in ring:
            la, lo = (fwd * pygplates.PointOnSphere(lat, lng)).to_lat_lon()
            moved.append([round(la, 2), round(lo, 2)])
        los = [p[1] for p in moved]
        if max(los) - min(los) > 180:  # wrapped across the dateline; skip to avoid smear
            continue
        out_rings.append(moved)
    return out_rings


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
