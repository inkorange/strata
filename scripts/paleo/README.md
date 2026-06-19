# Paleo land pipeline

Generates `src/tectonics/paleoLand.generated.json` — per-era paleoshoreline land
polygons (`{ eraId: number[][][] }`, rings of `[lat, lng]`) for the tectonics
era viewer. The JSON is **committed**, so building/running the app needs none of
this — only re-run when changing eras, resolution, or simplification.

## Run

```bash
pip install --user numpy xarray netCDF4 matplotlib shapely gplately pygplates
python3 scripts/paleo/build_paleo_land.py
```

Downloads the PaleoDEM once into `scripts/paleo/_cache/` (gitignored).

## What it does

- **Past eras** (Permo-Triassic 250, Late Jurassic 150, Mid-Cretaceous 90,
  Early Eocene 50, Holocene 0 Ma): thresholds the PaleoDEM elevation grid at sea
  level (≥ 0 m = land), polygonizes via filled contour, unions/simplifies, and
  drops sub-2°² islands. Flooded continental interiors fall out naturally
  (they're below sea level). Longitudes are bounded to ±180° by the grid, so no
  antimeridian wrap/smear.
- **Future era** (−50 Ma): no paleogeography exists ahead of present, so present
  coastlines are partitioned onto their plates and extrapolated forward 50 My via
  each plate's most-recent stage rotation, then re-merged. Labeled a projection
  in-app.

## Data & licensing (CC-BY — attribution required, shown in the app footer)

- **PaleoDEM:** Scotese, C.R. & Wright, N. (2018). *PALEOMAP Paleodigital
  Elevation Models (PaleoDEMs) for the Phanerozoic.* Zenodo.
  https://doi.org/10.5281/zenodo.5460860 — CC-BY-4.0.
- **Plate rotations** (future projection only): Müller, R.D., et al. (2019),
  EarthByte, via the `gplately`/`pygplates` `Muller2019` model — CC-BY.
