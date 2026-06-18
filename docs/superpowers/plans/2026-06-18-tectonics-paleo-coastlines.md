# Tectonics — Real Paleoshoreline Continents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tectonics era viewer's repositioned-modern-coastline continents with real, era-specific paleoshorelines (flooded interiors) baked from the CC-BY Scotese & Wright 2018 PaleoDEM, and crossfade between eras instead of vertex-morphing.

**Architecture:** A one-time offline Python pipeline downloads the PaleoDEM, thresholds each era's grid at sea level, polygonizes the land, simplifies it, and emits `paleoLand.generated.json` (era → multipolygon). The app renders a single crossfading land layer per era (plates keep their existing vertex-morph).

**Tech Stack:** Python (numpy, xarray/netCDF4, matplotlib, shapely, pygplates/gplately) offline; Next.js + React-three-fiber runtime.

**Spec:** `docs/superpowers/specs/2026-06-18-tectonics-paleo-coastlines-design.md`
**Branch:** `tectonics-paleo-coastlines` (already on it). The feasibility spike already proved every step; `scripts/paleo/_cache/` (gitignored) holds the downloaded PaleoDEM.

---

## File Structure

```
scripts/paleo/
  build_paleo_land.py          # CREATE — the offline pipeline (past eras = DEM; future = projection)
  README.md                    # CREATE — dataset, version, CC-BY citations, how to run
  (_cache/ gitignored)         # downloaded PaleoDEM + intermediates
src/tectonics/
  paleoLand.generated.json     # CREATE (generated) — { eraId: number[][][] } land rings per era
  eras.ts                      # MODIFY — add Era.land from JSON; remove continents/ContinentAtEra/ContinentId
  eras.spec.ts                 # MODIFY — drop continent tests; add land tests
  landLayers.ts                # CREATE — pure crossfade-layer selector (unit-tested)
  landLayers.spec.ts           # CREATE
  tweenPlates.ts               # MODIFY — remove tweenContinents + TweenedContinent (plates unchanged)
  tweenPlates.spec.ts          # MODIFY — drop tweenContinents tests
  scene/Land.tsx               # CREATE — landmass mesh with opacity (adapted from Continent.tsx)
  scene/Continent.tsx          # DELETE — replaced by Land.tsx
  scene/Plates.tsx             # MODIFY — crossfade land layers; keep plate morph
src/ui/SiteFooter.tsx          # MODIFY — add CC-BY attribution line
```

---

## Task 1: Offline pipeline → generated paleo land JSON

**Files:**
- Create: `scripts/paleo/build_paleo_land.py`
- Create: `scripts/paleo/README.md`
- Create (generated): `src/tectonics/paleoLand.generated.json`

This is an offline data-generation task (not TDD): the "test" is that the emitted JSON has the right shape and sane geometry, asserted at the end of the script and again in `eras.spec.ts` (Task 5).

- [ ] **Step 1: Write the pipeline script**

Create `scripts/paleo/build_paleo_land.py`:

```python
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
import numpy as np, xarray as xr
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from shapely.geometry import Polygon
from shapely.ops import unary_union

CACHE = os.path.join(os.path.dirname(__file__), "_cache")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "tectonics", "paleoLand.generated.json")
DEM_ZIP_URL = ("https://zenodo.org/records/5460860/files/"
               "Scotese_Wright_2018_Maps_1-88_1degX1deg_PaleoDEMS_nc.zip?download=1")

# Era id -> target age (Ma). Past eras read the DEM; 'future' is projected.
PAST_AGES = {"pangaea": 250, "late-jurassic": 150, "late-cretaceous": 90,
             "eocene": 50, "present": 0}
FUTURE_ID, FUTURE_AGE = "future", -50

SEA_LEVEL = 0.0          # elevation threshold (m) for land
MIN_AREA_DEG2 = 2.0      # drop islands smaller than this (deg^2) to keep it light
SIMPLIFY_TOL = 0.7       # Douglas-Peucker tolerance (degrees)

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
        m = re.findall(r"(\d+)Ma", n); return int(m[-1]) if m else None
    cand = [(a(n), n) for n in ncs if a(n) is not None]
    return min(cand, key=lambda t: abs(t[0] - age))[1]

def _rings_from_grid(lon, lat, Z):
    """Return list of [ [lat,lng], ... ] closed rings for land (Z >= SEA_LEVEL)."""
    cs = plt.contourf(lon, lat, Z, levels=[SEA_LEVEL, 1e9])
    paths = cs.get_paths()
    polys = []
    for p in paths:
        for ring in p.to_polygons():
            if len(ring) >= 4:
                poly = Polygon(ring)
                if poly.is_valid and poly.area > 0:
                    polys.append(poly)
    if not polys:
        return []
    land = unary_union([p.buffer(0) for p in polys])
    geoms = list(land.geoms) if land.geom_type == "MultiPolygon" else [land]
    rings = []
    for g in geoms:
        if g.area < MIN_AREA_DEG2:
            continue
        s = g.simplify(SIMPLIFY_TOL, preserve_topology=True)
        if s.is_empty:
            continue
        # contourf x=lon, y=lat -> ring coords are (lon, lat); emit [lat, lng]
        coords = list(s.exterior.coords)
        ring = [[round(float(y), 2), round(float(x), 2)] for x, y in coords]
        if len(ring) >= 4:
            rings.append(ring)
    return rings

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
    import gplately, pygplates
    gd = gplately.DataServer("Muller2019")
    rot, _, static = gd.get_plate_reconstruction_files()
    out_rings = []
    for ring in present_rings:
        # ring is [[lat,lng],...]; partition each ring's points to plates and
        # apply each plate's 1->0 Ma stage rotation x50, forward in time.
        pts = [pygplates.PointOnSphere(lat, lng) for lat, lng in ring]
        feat = pygplates.Feature()
        feat.set_geometry(pygplates.PolygonOnSphere(pts))
        partitioned = pygplates.partition_into_plates(static, rot, [feat])
        for pf in partitioned:
            pid = pf.get_reconstruction_plate_id()
            # stage rotation over the most recent 1 My, applied 50x forward
            stage = rot.get_rotation(0, pid, 1)  # rotation from 1Ma -> 0Ma
            fwd = pygplates.FiniteRotation(stage.get_euler_pole_and_angle()[0],
                                           stage.get_euler_pole_and_angle()[1] * 50.0)
            geom = pf.get_geometry()
            moved = fwd * geom
            ll = moved.to_lat_lon_list()
            out_rings.append([[round(la, 2), round(lo, 2)] for la, lo in ll])
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
        print(f"  {eid}: {len(rings)} land polygons, {sum(len(r) for r in rings)} pts", flush=True)
    # Future: project present coastlines forward (labeled projection in-app).
    try:
        data[FUTURE_ID] = _future_land(present_rings)
        print(f"  future: {len(data[FUTURE_ID])} land polygons (projected +50My)", flush=True)
    except Exception as e:
        print(f"  future projection failed ({e!r}); reusing present land as placeholder", flush=True)
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
```

- [ ] **Step 2: Run the pipeline**

Run: `python3 scripts/paleo/build_paleo_land.py`
Expected: prints each era's polygon count and `wrote .../src/tectonics/paleoLand.generated.json`. If the future projection errors, it falls back to present land (acceptable; the era is a labeled projection).

- [ ] **Step 3: Write the README**

Create `scripts/paleo/README.md` with: the dataset name + Zenodo DOI (10.5281/zenodo.5460860, CC-BY-4.0), the Müller 2019 rotation model citation (CC-BY) used for the future projection, the exact run command, and a note that `src/tectonics/paleoLand.generated.json` is generated output committed to the repo so contributors don't need GPlates.

- [ ] **Step 4: Commit**

```bash
git add scripts/paleo/build_paleo_land.py scripts/paleo/README.md src/tectonics/paleoLand.generated.json .gitignore
git commit -m "tectonics: paleo land pipeline (Scotese PaleoDEM, CC-BY) + generated per-era land"
```

---

## Task 2: Data model — `Era.land`, remove continents

**Files:**
- Modify: `src/tectonics/eras.ts`

- [ ] **Step 1: Add the `land` field + import generated data; drop continent types**

In `eras.ts`:
1. Add at top: `import PALEO_LAND from './paleoLand.generated.json'`
2. Add to the `Era` interface: `land: ReadonlyArray<ReadonlyArray<readonly [number, number]>>` (multipolygon: array of `[lat,lng]` rings).
3. Remove `ContinentId`, `ContinentAtEra`, and the `continents` field from `Era`.
4. For each era object, **remove** its `continents: [...]` property and **add** `land: PALEO_LAND['<eraId>'] as ...` — i.e. set `land` from the generated JSON keyed by the era id. (Cast the imported JSON value to the `land` type.)
5. Keep `CONTINENT_COLOR` (now the land fill color) and all plate data unchanged.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: errors only where `continents`/`tweenContinents`/`Continent` are still referenced (fixed in Tasks 3–4). Resolve the eras.ts-local ones; cross-file ones are expected until those tasks.

- [ ] **Step 3: Enable JSON import (if needed)**

If `pnpm typecheck` complains about importing `.json`, confirm `resolveJsonModule` is set in `tsconfig.json` (Next.js defaults it on). If not present, add `"resolveJsonModule": true` to `compilerOptions`.

- [ ] **Step 4: Commit** (after Task 4 compiles cleanly — this task alone won't typecheck standalone; commit together with Tasks 3–4 or stage now and commit at Task 4).

---

## Task 3: Crossfade layer selector + drop continent tween

**Files:**
- Create: `src/tectonics/landLayers.ts`
- Create: `src/tectonics/landLayers.spec.ts`
- Modify: `src/tectonics/tweenPlates.ts`
- Modify: `src/tectonics/tweenPlates.spec.ts`

- [ ] **Step 1: Write the failing test for the layer selector**

Create `src/tectonics/landLayers.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ERAS_BY_ID } from './eras'
import { landLayers } from './landLayers'

describe('landLayers', () => {
  it('at rest (no target) returns one full-opacity layer of the current era', () => {
    const layers = landLayers('present', null, 0)
    expect(layers).toHaveLength(1)
    expect(layers[0]!.opacity).toBe(1)
    expect(layers[0]!.polygons).toBe(ERAS_BY_ID.present.land)
  })

  it('mid-transition returns source fading out + target fading in (opacities sum to 1)', () => {
    const layers = landLayers('present', 'eocene', 0.25)
    expect(layers).toHaveLength(2)
    const [src, tgt] = layers
    expect(src!.polygons).toBe(ERAS_BY_ID.present.land)
    expect(tgt!.polygons).toBe(ERAS_BY_ID.eocene.land)
    expect(src!.opacity).toBeCloseTo(0.75, 6)
    expect(tgt!.opacity).toBeCloseTo(0.25, 6)
  })

  it('at t>=1 the target is fully opaque', () => {
    const layers = landLayers('present', 'eocene', 1)
    expect(layers.find((l) => l.polygons === ERAS_BY_ID.eocene.land)!.opacity).toBe(1)
  })
})
```

- [ ] **Step 2: Run it (fails — module missing)**

Run: `pnpm test src/tectonics/landLayers.spec.ts`
Expected: FAIL — cannot resolve `./landLayers`.

- [ ] **Step 3: Implement the selector**

Create `src/tectonics/landLayers.ts`:

```ts
import { type Era, ERAS_BY_ID } from './eras'

export interface LandLayer {
  /** Stable key for React. */
  key: string
  polygons: Era['land']
  opacity: number
}

/**
 * Land render layers for the current transition. At rest (no target) returns a
 * single full-opacity layer of the current era. During a transition returns the
 * source era fading out and the target era fading in — paleoshorelines are
 * independent per era, so we crossfade rather than vertex-morph.
 */
export function landLayers(
  currentEraId: Era['id'],
  targetEraId: Era['id'] | null,
  eased: number,
): LandLayer[] {
  const current = ERAS_BY_ID[currentEraId]
  if (targetEraId === null || targetEraId === currentEraId) {
    return [{ key: currentEraId, polygons: current.land, opacity: 1 }]
  }
  const target = ERAS_BY_ID[targetEraId]
  return [
    { key: currentEraId, polygons: current.land, opacity: 1 - eased },
    { key: targetEraId, polygons: target.land, opacity: eased },
  ]
}
```

- [ ] **Step 4: Run it (passes)**

Run: `pnpm test src/tectonics/landLayers.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Remove `tweenContinents` + `TweenedContinent` from `tweenPlates.ts`**

Delete the `TweenedContinent` interface and the entire `tweenContinents` function (lines 54–116). Keep `tweenPlates` and `TweenedPlate` unchanged. Remove the now-unused `ContinentId` import (change `import type { ContinentId, Era, PlateId }` to `import type { Era, PlateId }`).

- [ ] **Step 6: Update `tweenPlates.spec.ts`**

Remove any `tweenContinents` import and its test block(s); keep the `tweenPlates` tests.

- [ ] **Step 7: Run + commit**

Run: `pnpm test src/tectonics/landLayers.spec.ts src/tectonics/tweenPlates.spec.ts`
Expected: PASS.

```bash
git add src/tectonics/landLayers.ts src/tectonics/landLayers.spec.ts src/tectonics/tweenPlates.ts src/tectonics/tweenPlates.spec.ts
git commit -m "tectonics: crossfade land-layer selector; drop continent vertex-tween"
```

---

## Task 4: Render crossfading land (Land.tsx + Plates.tsx)

**Files:**
- Create: `src/tectonics/scene/Land.tsx`
- Delete: `src/tectonics/scene/Continent.tsx`
- Modify: `src/tectonics/scene/Plates.tsx`

- [ ] **Step 1: Create `Land.tsx` (adapted from Continent.tsx, with opacity)**

Create `src/tectonics/scene/Land.tsx` — identical triangulation to `Continent.tsx` but the material is transparent and takes an `opacity` prop:

```tsx
'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { triangulatePolygonOnSphere } from '../sphericalGeometry'

const LAND_RADIUS = 1.003
const SUBDIVISION_LEVELS = 2

interface LandProps {
  polygons: ReadonlyArray<ReadonlyArray<readonly [number, number]>>
  color: string
  opacity: number
}

/**
 * Renders an era's landmasses as filled meshes on the sphere. Each polygon
 * piece is triangulated independently with radial outward normals (avoids
 * facet lines). `opacity` drives the crossfade between eras; geometry is
 * memoized on `polygons` (stable per era) so opacity changes are cheap.
 */
export function Land({ polygons, color, opacity }: LandProps) {
  const pieces = useMemo(() => {
    return polygons
      .filter((p) => p.length >= 3)
      .map((piece, i) => {
        const { positions, indices } = triangulatePolygonOnSphere(
          piece,
          LAND_RADIUS,
          SUBDIVISION_LEVELS,
        )
        if (indices.length === 0) return null
        const geom = new THREE.BufferGeometry()
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geom.setIndex(new THREE.BufferAttribute(indices, 1))
        const normals = new Float32Array(positions.length)
        for (let v = 0; v < positions.length; v += 3) {
          const x = positions[v] ?? 0
          const y = positions[v + 1] ?? 0
          const z = positions[v + 2] ?? 0
          const len = Math.hypot(x, y, z) || 1
          normals[v] = x / len
          normals[v + 1] = y / len
          normals[v + 2] = z / len
        }
        geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
        return { geom, key: `p${i}-v${piece.length}` }
      })
      .filter((p): p is { geom: THREE.BufferGeometry; key: string } => p !== null)
  }, [polygons])

  if (pieces.length === 0 || opacity <= 0) return null

  return (
    <group>
      {pieces.map(({ geom, key }) => (
        <mesh key={key} geometry={geom}>
          <meshStandardMaterial
            color={color}
            metalness={0.05}
            roughness={0.95}
            transparent
            opacity={opacity}
            depthWrite={opacity > 0.98}
          />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Rewrite `Plates.tsx` to crossfade land**

Replace continent tween usage with the crossfade selector. Key changes:
- Import `landLayers` from `../landLayers` and `Land` from `./Land`; remove `Continent`, `tweenContinents`, `TweenedContinent`, `CONTINENT_COLOR` stays imported from `../eras`.
- Replace `tweenedContinents` state with `landRender` state: `useState<ReturnType<typeof landLayers>>(() => landLayers(currentEraId, null, 0))`.
- In the `useEffect` (target null / reduced-motion branches) set `landRender` via `landLayers(currentEraId, null, 0)` (rest) or `landLayers(currentEraId, targetEraId, 1)` (reduced-motion instant).
- In `useFrame`, after computing `eased`, set `landRender` to `landLayers(currentEraId, targetEraId, eased)` alongside the existing `setTweenedPlates`.
- In render, replace the continent map with:
  ```tsx
  {landRender.map((layer) => (
    <Land key={layer.key} polygons={layer.polygons} color={CONTINENT_COLOR} opacity={layer.opacity} />
  ))}
  ```
- Keep the plate rendering (`tweenedPlates.map(... <Plate/>)`) exactly as-is.

- [ ] **Step 3: Delete `Continent.tsx`**

```bash
git rm src/tectonics/scene/Continent.tsx
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm exec biome check src/tectonics/scene/Land.tsx src/tectonics/scene/Plates.tsx`
Expected: clean (no references to removed Continent/tweenContinents remain).
Run: `pnpm build` — expect success (scene graph compiles).

- [ ] **Step 5: Commit**

```bash
git add src/tectonics/scene/Land.tsx src/tectonics/scene/Plates.tsx src/tectonics/eras.ts
git commit -m "tectonics: render crossfading paleoshoreline land per era"
```

---

## Task 5: Update data-integrity tests

**Files:**
- Modify: `src/tectonics/eras.spec.ts`

- [ ] **Step 1: Replace the `ERAS continents` block with `ERAS land` tests**

Remove the `REQUIRED_CONTINENT_IDS` const, the `ContinentId` import, and the entire `describe('ERAS continents', ...)` block. Add:

```ts
describe('ERAS land', () => {
  it.each(REQUIRED_ERA_IDS)('era %s has non-empty land polygons', (eraId) => {
    const era = ERAS.find((e) => e.id === eraId)
    expect(era).toBeDefined()
    if (!era) return
    expect(era.land.length).toBeGreaterThan(0)
  })

  it('every land ring has >=4 points and valid lat/lng', () => {
    for (const era of ERAS) {
      for (const ring of era.land) {
        expect(ring.length).toBeGreaterThanOrEqual(4)
        for (const [lat, lng] of ring) {
          expect(lat).toBeGreaterThanOrEqual(-90)
          expect(lat).toBeLessThanOrEqual(90)
          expect(lng).toBeGreaterThanOrEqual(-180)
          expect(lng).toBeLessThanOrEqual(180)
        }
      }
    }
  })
})
```

- [ ] **Step 2: Run + commit**

Run: `pnpm test src/tectonics/eras.spec.ts`
Expected: PASS (plate tests + new land tests).

```bash
git add src/tectonics/eras.spec.ts
git commit -m "tectonics: data tests for per-era paleo land (drop continent invariants)"
```

---

## Task 6: CC-BY attribution

**Files:**
- Modify: `src/ui/SiteFooter.tsx`

- [ ] **Step 1: Add an attribution line**

Add a small muted line to the footer crediting the data sources (CC-BY requires attribution), e.g.:
`Paleogeography: Scotese & Wright (2018) PALEOMAP PaleoDEMs (CC-BY 4.0); plate rotations: Müller et al. (2019), EarthByte (CC-BY).`
Match the footer's existing text style/classes. Read `src/ui/SiteFooter.tsx` first and insert consistently.

- [ ] **Step 2: Verify + commit**

Run: `pnpm typecheck`
```bash
git add src/ui/SiteFooter.tsx
git commit -m "tectonics: credit PaleoDEM + rotation data (CC-BY attribution)"
```

---

## Task 7: Full verification

- [ ] **Step 1: Run everything**

```bash
pnpm typecheck
pnpm test
pnpm exec biome check src/tectonics scripts 2>&1 | tail -3   # new files clean (pre-existing repo debt allowed)
pnpm test:e2e --workers=1
pnpm build
```
Expected: typecheck clean; unit tests pass (incl. new land + landLayers); e2e green (tectonics specs still pass — sidebar/timeline unaffected); build succeeds.

- [ ] **Step 2: Manual visual pass**

`pnpm dev` → `/tectonics`. Click **Late Jurassic**: it should crossfade to a fused Gondwana, closed South Atlantic, India as a separate block, with flooded interiors — matching the reference. Scrub all eras; confirm smooth crossfades and that plates still move.

- [ ] **Step 3: Final commit (if any cleanup)**

```bash
git add -A && git commit -m "tectonics: paleo-coastline cleanup"
```

---

## Done

Era continents are now real paleoshorelines per era (CC-BY PaleoDEM), crossfading between eras; plates still morph; the era-marker click fix from earlier is already on the branch. After verification, use **superpowers:finishing-a-development-branch** to open the PR.
