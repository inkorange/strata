# Tectonics — Real Paleoshoreline Continents — Design

**Status:** Approved-pending-review for a Tectonics follow-up PR
**Date:** 2026-06-18
**Branch:** `tectonics-paleo-coastlines` (off `main`)
**Scope:** Replace the era viewer's continent outlines with real, era-specific paleoshorelines so each era looks paleogeographically accurate (DESIGN.md §2 Module A, target misconception "the map always looked this way").

## 1. Problem

Every era currently reuses the **same modern continent outline, rigidly repositioned** — verified: North America carries an identical 1,137-edge modern coastline in all six eras, only its location changes. So ancient eras look like today's continents shuffled around, not how Earth actually looked: at 150 Ma there should be a fused Gondwana, no South Atlantic, India as a separate block near Antarctica, and continents flooded by shallow epicontinental seas. None of that can come from a repositioned modern outline.

## 2. Approach (decided)

- **True paleoshorelines per era** (not repositioned modern coastlines): each era gets its own independent shoreline geometry, including flooded continental interiors.
- **Source:** the open scientific record via **pyGPlates** + an openly-licensed (CC-BY) **paleogeography/paleoshoreline** dataset (e.g., Cao et al. 2017 "global paleogeography", or the EarthByte paleogeography feature set) reconstructed with its companion rotation model. One-time **offline pipeline**; runtime ships only baked JSON (no GPlates dependency, no bundle bloat).
- **Scope:** continents only. Plate-boundary outlines, ocean, colors, names, descriptions, timeline UI, and the geologic-time scrubber are unchanged.
- **Transition:** because each era's shoreline is independent geometry (vertices don't correspond across eras), continents **crossfade** between eras instead of vertex-morphing. This is a deliberate, accepted change and removes the current matched-vertex-count constraint for continents.

### Why crossfade (not morph)

The existing SLERP morph requires vertex i at era E to be the same point at era E+1. True paleoshorelines have different topology and vertex counts per era (continents merge/split, seas flood/drain), so there is no meaningful per-vertex correspondence. Crossfading (fade era A out, era B in) is the honest transition for independent geometries. **Plates keep their existing vertex-morph** (they remain the 7-plate matched-count abstraction); only continents change to crossfade. A mixed transition — plates sliding while land crossfades — reads fine on the 5 s scrubber tween.

## 3. Offline pipeline (`scripts/paleo/`)

Python + `pygplates`, committed for reproducibility; run by a developer (or in CI once), not at app runtime.

1. **Fetch** the chosen CC-BY dataset: paleogeography/paleoshoreline feature collections + `.rot` rotation model + static plate polygons. Pin the exact version; record citation.
2. **Reconstruct** the paleoshoreline polygons to each **past** era age: `[250, 150, 90, 50, 0]` Ma via `pygplates.reconstruct`.
3. **Future era (−50 Ma):** no paleogeography exists ahead of present, so for this one era reconstruct **present coastlines forward 50 My** (plate-partitioned, projected via the rotation model's latest stage) and label it a projection. This is the single lower-rigor era, by necessity.
4. **Bucket** each era's reconstructed land polygons into the 7 continent IDs (`north-america, south-america, eurasia, africa, india, australia, antarctica`) by plate ID → continent map. (All continents render one `CONTINENT_COLOR`, so bucketing is for data structure/labels, not color.)
5. **Simplify** each era's polygons to a manageable budget (Douglas–Peucker tolerance + drop sub-threshold islands + cap pieces/continent), targeting a small total vertex count per era for smooth rendering. No cross-era count matching required.
6. **Antimeridian:** split rings crossing ±180° so they don't smear across the globe.
7. **Emit** `src/tectonics/paleoContinents.generated.json`: `{ [eraId]: { [continentId]: number[][][] } }` (multipolygon of `[lat,lng]` rings), plus a short provenance header (dataset, version, citation, generation date).

## 4. App integration

- **Data:** `eras.ts` imports `paleoContinents.generated.json` and uses it for `continents[*].polygons` per era. `PlateAtEra`, plate data, colors, names, `mya`, and descriptions are untouched. The `ContinentAtEra` doc comment is updated: polygons are now **independent per era** (no cross-era count matching).
- **Rendering (`src/tectonics/scene/Plates.tsx`, `Continent.tsx`):** replace continent vertex-morph with a crossfade.
  - At rest (`targetEraId === null`): render `currentEra` continents at opacity 1.
  - During a transition: render BOTH `currentEra` continents (opacity `1 − eased`) and `targetEra` continents (opacity `eased`) over the existing 5 s eased window; on completion, only the new era remains.
  - `Continent.tsx` gains an `opacity` prop; its material becomes `transparent` with per-frame opacity. Plates continue to use `tweenPlates` unchanged.
  - `tweenContinents` (SLERP) is removed/replaced by this crossfade selection; `tweenPlates` stays.
- **Reduced motion:** crossfade collapses to an instant swap (matches the existing reduced-motion branch).

## 5. Reproducibility & licensing

- Commit `scripts/paleo/` (pipeline + a `README.md` with exact dataset/version, rotation model, and the CC-BY citation/attribution).
- Surface a one-line attribution in the app credits/footer (CC-BY requires attribution).
- The generated JSON is committed so contributors don't need GPlates to build/run.

## 6. Testing

- **`eras.spec.ts`:** drop the continent cross-era matched-count assertion. Add: every era has all 7 continent IDs present; all `[lat,lng]` within `[-90,90]/[-180,180]`; each ring has ≥3 points and is non-degenerate. Plate matched-count tests stay.
- **Engine:** unit-test the crossfade opacity selection (rest = 1.0 for current; mid-transition = both partial summing to 1; t≥1 = target only).
- **Manual visual pass:** Late Jurassic (150 Ma) matches the reference — fused Gondwana, closed South Atlantic, India a separate block near Antarctica, flooded interiors visible.
- `pnpm typecheck / lint / test / test:e2e / build` green.

## 7. Risks

- **Feasibility spike first:** the opening implementation task installs `pygplates`, fetches the dataset, and reconstructs one era end-to-end to confirm the toolchain works in this environment **before** building the full pipeline. Fallback if blocked: hand-trace paleoshorelines from CC-BY reference maps for the 6 eras (lower rigor) — revisit with the user if the spike fails.
- **Dataset licensing:** must be CC-BY/CC0 (no Scotese PALEOMAP proprietary imagery). Confirm during the spike.
- **Crossfade overlap:** same-color semi-transparent land from two eras overlaps mid-transition; acceptable for a 5 s educational tween, tunable later.

## 8. Out of scope

- Plate-boundary reconstruction (plates stay the current abstraction; still morph).
- Sea-level/paleo-DEM shading, paleoclimate, or per-continent recoloring.
- True morphing of continents (explicitly replaced by crossfade).

---

**End of design document.**
