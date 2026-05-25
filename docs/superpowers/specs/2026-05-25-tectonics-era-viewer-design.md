# Tectonics Era Viewer — Design

**Status:** Approved for the first Tectonics PR
**Date:** 2026-05-25
**Scope:** First PR of the Tectonics module (DESIGN.md §2 Module A, §11 Phase 2 flagship)

## 1. Goals and constraints

Replace the `/tectonics` "Module under construction" placeholder with a **read-only animated viewer** of how Earth's tectonic plates have evolved across geological time. The user does not manipulate plates — they navigate through pre-defined eras and watch the plates animate from one configuration to the next.

This is intentionally narrower than DESIGN.md §2's broader Module A vision (which included plate dragging, boundary classification, and earthquake placement). Those simulation features are deferred to follow-up PRs. This first PR establishes the data model, the rendering pipeline, and the navigation UI; future PRs can layer interaction on top.

**Why narrow first:** the viewer is shippable as a complete pedagogical tool on its own — it directly addresses DESIGN.md §2's target misconception ("landforms are static / the map always looked this way") without the engineering complexity of interactive plate dragging on a sphere.

### Success criteria

1. Visiting `/tectonics` from the hub dollies the camera in and shows Earth's plates at the **Present** configuration as colored polygons on the sphere surface.
2. A horizontal timeline at the bottom of the viewport shows six era markers plotted by their Mya (millions of years ago) value. Each marker is clickable.
3. Clicking an era marker animates each plate's vertices from its current position to the target era's position via SLERP-based spherical interpolation, over ~5 seconds.
4. A Play button on the timeline runs a continuous play-through across all six eras (total ~30 seconds).
5. The sidebar shows the current era's name + Mya + a tier-appropriate description (Beginner / Standard / Advanced).
6. Plate names are visible on plates: always-on for Beginner tier, on hover only for Standard / Advanced.
7. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build` all pass.

### Inherited constraints from DESIGN.md

- One persistent scene graph (§13.2) — plates render inside the existing `PersistentScene`, conditionally based on `activeModule`.
- Mobile-first responsive layout (§7) — desktop has side-pinned sidebar + bottom timeline; mobile combines them into one bottom sheet.
- Tier-aware UI (§1, §7) — descriptions, plate labels, and units adapt to tier override.
- Reduced-motion accessibility (§3, §13.5) — when `prefers-reduced-motion: reduce`, animations between eras are instant rather than tweened.
- No backend in v1 (§1) — all era data is bundled in client code.

---

## 2. File structure

All new code lives under `src/tectonics/`. Two existing files get small edits:

```
src/tectonics/
├─ eras.ts                   # Era data: 6 entries with full plate vertex sets per era
├─ eras.spec.ts              # Tests: data integrity (all plate IDs present in all eras, lat/lng range, etc.)
├─ sphericalGeometry.ts      # Pure helpers: latLngToVec3, slerpOnSphere, triangulatePolygonFan
├─ sphericalGeometry.spec.ts
├─ tweenPlates.ts            # Pure: tweenPlates(source, target, t) → interpolated plates
├─ tweenPlates.spec.ts
├─ tectonicsSlice.ts         # Zustand slice merged into useStore
├─ tectonicsSlice.spec.ts
├─ scene/
│  ├─ Plates.tsx             # R3F group, conditional on activeModule === 'tectonics'
│  └─ Plate.tsx              # Single plate mesh; receives tweened vertices from parent
└─ ui/
   ├─ TectonicsBody.tsx      # Sidebar body: era name + Mya + description (tier-aware)
   └─ Timeline.tsx           # Bottom-of-viewport timeline + Play button
```

Existing files modified:

- `src/scene/PersistentScene.tsx` — add `<Plates />` as a child (always rendered, gates itself by store state).
- `src/shell/modules.tsx` — replace `tectonics.Body: makeStub('Tectonics', '#ff8c5a')` with `tectonics.Body: TectonicsBody` (imported from `src/tectonics/ui/TectonicsBody`).
- `src/store/index.ts` — fold `createTectonicsSlice` into the combined store factory alongside `createShellSlice`.

Tests:
- All four pure-TS modules (`eras`, `sphericalGeometry`, `tweenPlates`, `tectonicsSlice`) get strict TDD coverage.
- R3F components (`Plates`, `Plate`) and UI (`Timeline`, `TectonicsBody`) get manual visual + Playwright e2e coverage.

---

## 3. Data model

### 3.1 Plate identity

A fixed set of seven plate IDs covers the major tectonic plates throughout the period covered:

```ts
export type PlateId =
  | 'pacific'
  | 'north-american'
  | 'eurasian'
  | 'african'
  | 'south-american'
  | 'antarctic'
  | 'indo-australian'
```

Every era contains exactly these seven plates. Plates that didn't exist as discrete entities at a given era (e.g., the Indo-Australian plate didn't fully form until the Cretaceous) are represented as the closest progenitor configuration. This simplification is acceptable for pedagogical clarity at this tier; academic precision is a non-goal.

### 3.2 Plate-at-era

```ts
export interface PlateAtEra {
  id: PlateId
  /**
   * Polygon vertices in [latitude, longitude] degrees, ordered counterclockwise
   * when viewed from outside the sphere (i.e., from space).
   * Range: latitude in [-90, 90], longitude in [-180, 180].
   * Length: 6 to 12 vertices per plate (hand-authored, simplified from
   * Scotese/PALEOMAP paleogeographic reconstructions).
   */
  vertices: ReadonlyArray<readonly [number, number]>
}
```

### 3.3 Era

```ts
export interface Era {
  id: 'pangaea' | 'late-jurassic' | 'late-cretaceous' | 'eocene' | 'present' | 'future'
  name: string
  mya: number  // millions of years ago; negative for future projections
  descriptionBeginner: string  // qualitative, friendly tutor register, no numbers
  descriptionStandard: string  // adds Mya, key geological events
  descriptionAdvanced: string  // adds tectonic stress context, specific phenomena
  plates: ReadonlyArray<PlateAtEra>  // exactly 7 entries, one per PlateId
}
```

### 3.4 The six eras

| id | name | mya | Narrative anchor |
| --- | --- | --- | --- |
| `pangaea` | Pangaea | 250 | All continents fused into a single supercontinent. |
| `late-jurassic` | Late Jurassic | 150 | Pangaea splitting; Atlantic Ocean opening. |
| `late-cretaceous` | Late Cretaceous | 90 | South America and Africa separated; India drifting toward Asia. |
| `eocene` | Eocene | 50 | India collides with Asia; Himalayas begin uplift. |
| `present` | Present | 0 | Current configuration. |
| `future` | Future (Projected) | -50 | Projected configuration based on current plate velocities. |

Era data lives in `eras.ts` as a `const ERAS: ReadonlyArray<Era>` with `as const` typing for compile-time safety.

### 3.5 Authoring approach

Vertex data is hand-authored based on standard paleogeographic reconstructions (Scotese / PALEOMAP work). Each plate has 6–12 vertices per era — enough to read as a recognizable plate shape, simple enough to triangulate cleanly via fan triangulation. The data is not procedurally derived; it is a curated dataset checked in as TypeScript source.

**Where the numbers come from:** the implementation plan (not this spec) provides the exact `[lat, lng]` arrays for all 42 plate-at-era entries. The plan author drafts the values referencing common paleogeographic imagery (e.g., Pangaea reconstructions, Cretaceous maps) at a simplified abstraction level. The implementer transcribes the values verbatim — no creative interpretation required. Visual refinement of plate shapes against reference imagery is expected to happen during a manual review pass after the implementation lands, potentially with iterative tuning of specific vertices.

For the first PR, the bar is "recognizable as Earth's continents at each era" — academic precision is a non-goal.

---

## 4. Pure-TS engine

Four pure-TS modules, all under strict TDD:

### 4.1 `sphericalGeometry.ts`

```ts
/** Converts a (lat, lng) degree pair to a 3D Cartesian point on a sphere of given radius. */
export function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3

/**
 * Spherical linear interpolation between two points on the unit sphere.
 * Both inputs must lie on the unit sphere (length 1); the output lies on the
 * unit sphere along the great-circle arc from a to b.
 * t in [0, 1]; t=0 returns a, t=1 returns b.
 */
export function slerpOnSphere(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3

/**
 * Triangulates a convex (or near-convex) polygon as a triangle fan from the
 * polygon's centroid. Returns flat Float32Array of vertex positions and a
 * Uint32Array of triangle indices.
 *
 * Limitations: only correct for convex polygons. For our hand-authored plate
 * polygons this constraint is acceptable — the authoring process simplifies
 * each plate to a near-convex outline.
 */
export function triangulatePolygonFan(
  verticesVec3: ReadonlyArray<THREE.Vector3>
): { positions: Float32Array; indices: Uint32Array }
```

**Why SLERP not lerp:** linear interpolation between lat/lng values has artifacts near the poles and near the antimeridian (e.g., interpolating from lng=170 to lng=-170 via linear interpolation goes the long way around the world). SLERP on 3D vectors always takes the shortest great-circle path.

**Why fan triangulation:** simpler than earcut or ear clipping for our use case. Our 7 plates × 6 eras are all curated to be reasonably convex. If a plate proves too irregular to fan-triangulate cleanly during implementation, we either subdivide the plate's vertex list or accept the minor visual artifact for v1.

### 4.2 `eras.ts`

Exports `ERAS: ReadonlyArray<Era>` (length 6) and the `PlateId` / `Era` / `PlateAtEra` types. No runtime logic — pure data.

### 4.3 `tweenPlates.ts`

```ts
export interface TweenedPlate {
  id: PlateId
  vertices: ReadonlyArray<readonly [number, number]>  // interpolated [lat, lng]
}

/**
 * Interpolates plate positions between two eras at progress t in [0, 1].
 * t=0 returns source plates verbatim; t=1 returns target plates verbatim.
 * Intermediate values SLERP each vertex along the great-circle arc from
 * source to target.
 *
 * Assumes source and target both contain all 7 PlateIds (validated at
 * data-integrity test time in eras.spec.ts).
 */
export function tweenPlates(source: Era, target: Era, t: number): ReadonlyArray<TweenedPlate>
```

Internally: for each plate ID, look up the source plate and target plate, then for each vertex index:
1. Convert source vertex `[lat, lng]` to 3D vector via `latLngToVec3`
2. Convert target vertex `[lat, lng]` to 3D vector
3. SLERP between them at progress `t`
4. Convert back to `[lat, lng]` (the consumer will re-project to 3D in the renderer)

The vertex count per plate is assumed identical between source and target eras (enforced by data-integrity test).

### 4.4 `tectonicsSlice.ts`

Tectonics-specific Zustand slice merged into `useStore`:

```ts
export interface TectonicsSlice {
  currentEraId: Era['id']
  targetEraId: Era['id'] | null
  tweenStartedAt: number | null  // performance.now() at tween start
  playing: boolean

  setTargetEra: (id: Era['id']) => void  // start a tween to id
  /** Called by the scene when a tween completes; commits target → current. */
  finishTween: () => void
  startPlaythrough: () => void
  stopPlaythrough: () => void
}
```

Defaults: `currentEraId: 'present'`, `targetEraId: null`, `tweenStartedAt: null`, `playing: false`.

Behavior:
- `setTargetEra(id)`: if `id === currentEraId` and not playing, no-op; else set `targetEraId = id`, `tweenStartedAt = performance.now()`.
- `finishTween()`: set `currentEraId = targetEraId`, clear `targetEraId` and `tweenStartedAt`. If `playing`, advance to next era in ERAS order (wrapping back to first after last).
- `startPlaythrough()`: set `playing = true`; if not currently tweening, set `targetEraId` to the next era.
- `stopPlaythrough()`: set `playing = false`. Current tween (if any) continues to completion but doesn't auto-advance.

The slice integrates into `useStore` alongside `shellSlice`. The combined store's persistence (currently only persists shell fields) does NOT persist tectonics state — eras reset to Present on reload.

---

## 5. Scene components

### 5.1 `<Plates>`

Reads `activeModule`, `currentEraId`, `targetEraId`, `tweenStartedAt` from the store. If `activeModule !== 'tectonics'`, returns `null`.

Otherwise renders a `<group>` containing seven `<Plate>` children. Each frame (via `useFrame`):
1. Compute progress `t`:
   - If `targetEraId === null`: `t = 1`, source = current, target = current
   - Else: `t = clamp((now - tweenStartedAt) / TWEEN_DURATION_MS, 0, 1)`, source = current era, target = target era
2. Compute eased `t` via smoothstep
3. Call `tweenPlates(source, target, eased)` → array of seven `TweenedPlate`
4. Pass each tweened plate's vertices to the corresponding `<Plate>` mesh
5. If `t >= 1` and `targetEraId !== null`: call `store.finishTween()`

`TWEEN_DURATION_MS = 5000` (5 seconds per era transition, giving ~30 seconds for the 6-era playthrough).

If `usePrefersReducedMotion()` returns true: skip the smoothstep, set `t = 1` immediately on `targetEraId` change so the tween is instant.

### 5.2 `<Plate>`

Receives plate id, color, and tweened vertices as props. Each frame, when vertices change:
1. Convert each `[lat, lng]` to `THREE.Vector3` via `latLngToVec3(lat, lng, 1.001)` — radius 1.001 sits 0.1% above the Earth surface (radius 1.0) to avoid z-fighting with the Earth's PBR materials.
2. Run `triangulatePolygonFan(vertices3d)` to get positions + indices.
3. Update the mesh's `BufferGeometry` attributes (`position`, `index`).

Material: `meshStandardMaterial` with the plate's color, `metalness: 0.05`, `roughness: 0.85`. Slightly emissive so plate boundaries read clearly against the Earth surface texture.

For plate labels (tier-dependent visibility), use drei's `<Html>` or `<Text>` positioned at the plate's centroid. Beginner tier: `<Text>` always visible. Standard/Advanced: rendered only when the plate is hovered (via `onPointerOver`/`onPointerOut` state).

### 5.3 Integration into `PersistentScene`

Add a single line: `<Plates />` rendered as a child of the existing `<Scene>` mount in `PersistentScene.tsx`. Plates self-gates on activeModule, so this mount is safe even on the hub and other modules.

---

## 6. UI components

### 6.1 `<TectonicsBody>`

Replaces the `makeStub('Tectonics', '#ff8c5a')` placeholder in `modules.tsx`. Rendered inside the sidebar of `ModuleFrame`.

Reads `currentEraId`, `targetEraId`, and the effective tier from the store. Determines the displayed era:
- If `targetEraId !== null`: display the target era's data (the user is animating toward this state).
- Else: display the current era's data.

Pulls description from `descriptionBeginner` / `descriptionStandard` / `descriptionAdvanced` per tier:
- `tierOverride` of `mobile-lite` → Beginner copy
- `tierOverride` of `balanced` → Standard copy
- `tierOverride` of `desktop-ultra` → Advanced copy
- `tierOverride` of `null` (auto) → Standard copy (sensible default)

Layout: era name (large), Mya value (small caption, hidden on Beginner tier per DESIGN.md §1 "no numbers"), description paragraph.

### 6.2 `<Timeline>`

Rendered by `TectonicsBody` and positioned at the bottom of the viewport via fixed positioning:

```
className="
  pointer-events-auto fixed z-20 bg-card/80 backdrop-blur rounded-lg border border-border/40
  bottom-4 inset-x-4
  sm:left-80 sm:right-4
"
```

On desktop, the sidebar occupies the left 288px (sm:w-72). Timeline sits to the right of it at the bottom with 16px gap. On mobile, the sidebar is a bottom sheet; Timeline becomes part of that sheet (inset-x-4, bottom-4).

Content (left-to-right):
- Play button (`▶` icon or `▢` stop icon when playing). Calls `startPlaythrough()` / `stopPlaythrough()`.
- Horizontal axis labeled with Mya values at the extremes (e.g., "250 Mya" on the left, "Present" in the middle, "+50 Mya" on the right).
- Six clickable era markers (circles) plotted by mya value. Position on the axis: `x = (era.mya - MAX_MYA) / (MIN_MYA - MAX_MYA)` where MAX_MYA = 250, MIN_MYA = -50.
- The current era's marker is filled and slightly larger. Others are outline only.
- During tween, a small progress indicator (filled bar from current era to target era) shows tween progress.

Hover on era marker: shows era name as a tooltip.
Click: `setTargetEra(era.id)`.

### 6.3 Plate name labels (tier-dependent)

For Beginner tier, each plate displays its name as a label always visible at the plate centroid. The label uses drei's `<Text>` component for in-scene 3D text (better than HTML for staying attached to the rotating sphere).

For Standard / Advanced, the label is only rendered while the user hovers the plate. Hover state is local React state on the plate component.

Plate name strings:
```ts
const PLATE_NAMES: Record<PlateId, string> = {
  pacific: 'Pacific',
  'north-american': 'North American',
  eurasian: 'Eurasian',
  african: 'African',
  'south-american': 'South American',
  antarctic: 'Antarctic',
  'indo-australian': 'Indo-Australian',
}
```

---

## 7. Layout summary

**Desktop (≥ 640px):**
- Top header (existing): BackToHub + accent + label + TierToggle
- Left sidebar (existing, from previous PR): `<TectonicsBody>` rendering era name + Mya + description
- Bottom-right (new): `<Timeline>` rendered by `TectonicsBody` via fixed positioning, sitting to the right of the sidebar
- Full-bleed canvas behind everything (existing `PersistentScene`)

**Mobile (< 640px):**
- Top header (existing)
- Bottom sheet (existing): contains `<TectonicsBody>` (era name + description) at the top of the sheet AND `<Timeline>` at the bottom of the sheet — they're stacked vertically within the same drawer
- Full-bleed canvas

Mobile note: the existing `ModuleFrame` sidebar uses `max-h-[35dvh]`. The combined era description + timeline needs more vertical space. **The implementation will increase `ModuleFrame`'s mobile sidebar to `max-h-[45dvh]` globally** — other current modules have less content and won't be affected, and future modules with more content can opt into scrolling instead of growing further.

The Timeline component handles its own desktop-vs-mobile positioning via Tailwind responsive classes — beyond the one-class height bump on `ModuleFrame`, no further changes to that file are needed.

---

## 8. Testing strategy

### 8.1 Pure-TS modules (strict TDD)

Failing test first, then implementation, then verify pass, then commit.

**`eras.spec.ts`:**
- All 6 eras present in `ERAS`
- Every era has exactly 7 plates, one per `PlateId`
- Every plate's vertices: lat in [-90, 90], lng in [-180, 180], length 6–12
- Plate vertex counts are consistent across eras (e.g., the Pacific plate has the same number of vertices in every era — required for `tweenPlates` to work cleanly)
- Every era has non-empty Beginner / Standard / Advanced descriptions

**`sphericalGeometry.spec.ts`:**
- `latLngToVec3(0, 0, 1)` ≈ `(1, 0, 0)`
- `latLngToVec3(90, 0, 1)` ≈ `(0, 1, 0)` (north pole)
- `latLngToVec3(0, 180, 1)` ≈ `(-1, 0, 0)` (antimeridian)
- SLERP at `t=0` returns source
- SLERP at `t=1` returns target
- SLERP at `t=0.5` returns the point with angle halfway between source and target (verified by dot product against both)
- `triangulatePolygonFan` with 4 input vertices returns 3 triangles (n-2 fan) with correct centroid

**`tweenPlates.spec.ts`:**
- `t=0` returns plates with vertices matching the source era verbatim
- `t=1` returns plates with vertices matching the target era verbatim
- `t=0.5` returns plates with vertices halfway between (verified by sampling one plate / one vertex)
- All 7 plates present in output

**`tectonicsSlice.spec.ts`:**
- Default state: `currentEraId='present'`, `targetEraId=null`, `playing=false`
- `setTargetEra('pangaea')` sets `targetEraId='pangaea'` and `tweenStartedAt > 0`
- `finishTween()` after `setTargetEra('pangaea')` commits to `currentEraId='pangaea'`, clears target
- `setTargetEra(currentEraId)` is a no-op (no tween)
- `startPlaythrough()` sets `playing=true` and triggers an initial target advance
- `stopPlaythrough()` sets `playing=false` but doesn't immediately clear an in-flight tween; on `finishTween` the auto-advance is suppressed

### 8.2 R3F + UI components

Manual visual review during implementation + Playwright e2e:

**`tests/e2e/tectonics.spec.ts` (new):**
- Navigate to `/tectonics`, verify canvas renders, verify timeline visible
- Verify Play button is clickable
- Click the "Pangaea" era marker on the timeline → after 6s, verify the era description in the sidebar updated to "Pangaea"
- Click Play → verify the marker advances through all eras (poll until all eras visited or test timeout)
- Verify the timeline is hidden on routes other than `/tectonics` (visit `/` and `/atmosphere`)

### 8.3 Visual approval gate

After the implementer reports all tasks complete, the user should visually verify:
1. Plates render distinctly with their colors at the Present configuration
2. Plate names appear (always-on for Beginner tier, hover for Standard/Advanced) — verify via tier toggle
3. Clicking each era animates the plates smoothly with no flicker
4. Play button walks through all eras over ~30 seconds
5. Returning to the hub hides the plates and shows the photoreal Earth unobstructed

---

## 9. Out of scope (intentional deferrals)

These belong in follow-up PRs, not this one:

- **Plate dragging.** User cannot manipulate plate positions. Future PR may add this for an interactive sandbox mode.
- **Boundary classification visualization.** No mountain extrusion, no rift valleys, no trenches, no earthquake glyphs. The plates are flat colored polygons at radius 1.001.
- **Velocity arrows.** No visible arrows showing plate motion direction. The motion is shown implicitly through the animation.
- **Stress/strain math at boundaries.** Advanced tier text mentions stress conceptually but doesn't compute it.
- **Tutor integration with scene state.** Tutor prompts are still the generic Tectonics prompts from Phase E's TutorPanel; they don't reference the current era. Wiring the tutor to era context is a follow-up.
- **Time scrubbing between eras.** Only discrete era selection is supported; no continuous slider. (A continuous slider could be added later by interpolating between adjacent eras based on slider position.)
- **Era data accuracy.** Plate positions are simplified curations, not academic-grade reconstructions. Future PRs may refine the data or source it from a paleogeographic library.
- **Camera-tracking-plate.** No "follow the Indian Plate as it collides with Asia" feature. The camera stays fixed at the current dolly position throughout.

---

## 10. Resolved decisions

These were debated during brainstorming; all are now settled.

1. **Read-only viewer, not interactive simulator.** Original DESIGN.md §2 imagined plate dragging; this first PR defers that. The viewer is a complete pedagogical tool on its own.

2. **6 eras including Future.** Pangaea, Late Jurassic, Late Cretaceous, Eocene, Present, plus a Future (+50 Mya) projection. The projection adds a "what's next?" pedagogical hook.

3. **Continuous SLERP-based animation, not stepped jumps.** Era transitions are smooth (5s each, smoothstep eased). Reduced-motion users get instant jumps.

4. **3D on the existing Earth sphere, not 2D map or flat 3D plane.** Plates render directly on the sphere at radius 1.001 above the Earth surface.

5. **5–7 teaching plates was the question; the answer is 7.** All seven major Earth plates included. Each era has all seven; plates that didn't fully exist as discrete entities in earlier eras get progenitor approximations.

6. **Tier-dependent plate name visibility.** Beginner tier always-on; Standard/Advanced hover-only.

7. **Sidebar shows era description, Timeline is bottom chrome.** On desktop they coexist; on mobile they share a single bottom sheet.

8. **Single PR scope.** No sub-decomposition of the viewer itself. Future Tectonics features (dragging, boundaries, earthquakes) get their own PRs.

---

**End of design document.**
