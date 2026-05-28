# Atmosphere Day-Cycle Viewer — Design

Module B of three (Tectonics → **Atmosphere** → Earth Systems), per
`.claude/DESIGN.md` §2 and §11 step 3. Read-only viewer that shows how solar
heating drives planetary atmospheric circulation across a 24-hour Earth day.

## 1. Goals and constraints

### Success criteria

- User enters the Atmosphere module from the hub. Camera dollies to the
  module's orbit position. Earth is visible with three atmospheric overlays:
  surface temperature heatmap, animated convection-cell arrows in 6 latitude
  bands, and an ITCZ cloud band at the equator. Sun is a visible luminary
  arcing across the sky.
- A 24-hour scrubber at the bottom advances the sun's position. The globe
  itself autorotates continuously (decoupled from the scrubber); the
  scrubber controls only the sun's position and the resulting ITCZ glow
  intensity. Other layers are static — they convey atmospheric *structure*,
  not weather dynamics.
- The three layers (`Cells`, `Temperature`, `Clouds`) toggle individually via
  chips above the scrubber. All three are on by default.
- Hovering or tapping any point on the globe surfaces that location's
  derived atmospheric values (temperature, pressure, dewpoint, lapse rate).
  Tier system controls the level of detail in the readout: Beginner = verbal
  labels, Standard = numbers, Advanced = numbers + lapse rate + a vertical
  temperature mini-profile.
- All cell-arrow animation is GPU-driven (shader uniforms scrolling dashes
  along tube geometry). No per-frame React state churn for the streamlines.
- New `src/atmos/` engine module mirrors the boundaries and test discipline
  of `src/tectonics/`. Pure TypeScript, no DOM, exhaustive unit coverage.
- Existing shell primitives are reused unchanged: `Scene`, `PersistentScene`,
  `CameraDolly`, `ModuleFrame`, `TutorPanel`, tier toggle, share via
  `/s/[hash]`.

### Inherited constraints from DESIGN.md

- §2 Module B target misconception: weather is random / disconnected from
  physical drivers. The module must teach that surface heating + Earth's
  rotation = banded circulation = predictable wind belts.
- §3 visual fidelity: realistic Earth as the hub object; this module adds
  atmospheric layers on top without breaking the photoreal aesthetic.
- §4 simulation engine: `src/atmos/` is the pure-TS engine. Heavily
  unit-tested. No DOM, no R3F imports from engine files.
- §5 state: Zustand + immer; same slice pattern as Molecular and Tectonics.
- §7 accent: `--accent-atmosphere: #5cc6ff` for chips, legend, and sun-track
  scrubber accent.
- §11 step 3: reuse every shell primitive from steps 1–2.

## 2. File structure

```
src/atmos/
├── solar.ts                  Sun direction + ITCZ brightness for a given hour
├── sample.ts                 (lat, lng, hour) → temp / pressure / dewpoint / lapse
├── cellBands.ts              Geometric layout: 6 bands × N arrows each on the sphere
├── atmosphereSlice.ts        Zustand slice: hour, layers, inspectAt
├── solar.spec.ts
├── sample.spec.ts
├── cellBands.spec.ts
├── atmosphereSlice.spec.ts
└── scene/
    ├── Atmosphere.tsx        Mount point — composes Sun + Heatmap + Cells + CloudBand
    ├── Sun.tsx               Directional light + visible sun sprite
    ├── Heatmap.tsx           Additive shell with latitude-gradient fragment shader
    ├── Cells.tsx             Builds all 6 bands' tube geometries; one mesh per band
    ├── CloudBand.tsx         ITCZ cloud band with sun-driven brightness uniform
    └── HoverInspector.tsx    Raycaster onto Earth → sets inspectAt in store

src/atmos/ui/
├── AtmosphereBody.tsx        Module body root — chips, scrubber, inspect readout
├── ChipBar.tsx               Floating layer-toggle chips above the scrubber
├── Timeline.tsx              24-hour scrubber (mirrors src/tectonics/ui/Timeline)
├── InspectReadout.tsx        Top-left data block (tier-aware)
└── Legend.tsx                Color legend for wind belts (collapsed by default)

src/scene/PersistentScene.tsx     +<Atmosphere/> mounted alongside <Plates/>
src/shell/modules.tsx             atmosphere.Body wired to AtmosphereBody (not stub)
src/ui/TutorPanel.tsx             updated SUGGESTED_PROMPTS.atmosphere

tests/e2e/atmosphere.spec.ts      end-to-end happy-path
```

## 3. Data model

### 3.1 `LatLng` and unit vectors

```ts
export type LatLng = readonly [number, number]   // [lat_deg, lng_deg]
```

Coordinate conventions follow `src/tectonics/sphericalGeometry.ts` exactly —
the Z-negated `latLngToVec3` already lives there and is re-used by
`cellBands.ts`. No new geometry primitives are introduced.

### 3.2 `Hour`

A scalar `0 ≤ h < 24` representing UTC clock time of the current day. h=12
corresponds to sun directly over the prime meridian (because we lock to
equinox; no axial tilt, no longitude offset to subsolar point).

### 3.3 `CellBand`

```ts
export interface CellBand {
  id: 'polar-n' | 'westerly-n' | 'trade-n' | 'trade-s' | 'westerly-s' | 'polar-s'
  latDeg: number                   // 75 | 45 | 15 | -15 | -45 | -75
  belt: 'trade' | 'westerly' | 'polar'
  /** Total arrows around the full latitude ring. Trade=8 / westerly=6 /
   *  polar=4, so ~half (4 / 3 / 2) are on the visible front of the globe
   *  from any single camera angle — matching the brainstormed mockup. */
  arrowsAroundRing: 4 | 6 | 8
  /** Per-arrow canonical shape: start / control / end offsets in
   *  surface-tangent local coordinates (units = degrees along-band and
   *  degrees perp-to-band). Same shape used for every arrow in the band;
   *  longitudinal placement is handled by cellBands.arrowArcPoints. */
  shape: { start: [number, number]; control: [number, number]; end: [number, number] }
}
```

The six bands are defined as a const array in `cellBands.ts`. Trade-wind
shapes curve toward the equator; westerly and polar shapes are nearly
straight along the band's circle of latitude.

### 3.4 `InspectSample`

```ts
export interface InspectSample {
  lat: number
  lng: number
  tempC: number
  pressureHpa: number
  dewpointC: number
  lapseCPerKm: number
  /** Verbal labels precomputed for the Beginner tier so UI never branches on tier internally */
  labels: { temp: string; humidity: string; wind: string }
}
```

### 3.5 `atmosphereSlice` state

```ts
interface AtmosphereSlice {
  hour: number                                    // 0–24 (continuous)
  layers: { cells: boolean; temp: boolean; clouds: boolean }
  inspectAt: LatLng | null                        // null = no current hover

  setHour: (h: number) => void
  toggleLayer: (k: keyof AtmosphereSlice['layers']) => void
  setInspectAt: (p: LatLng | null) => void
}
```

Defaults: `hour = 12`, all three layers `true`, `inspectAt = null`.

## 4. Pure-TS engine

### 4.1 `solar.ts`

```ts
/** Sun direction vector at a given UTC hour (equinox, no axial tilt).
 *  At h=0 the sun is over lng=-180° (date line, behind +X-aligned globe).
 *  At h=12 the sun is over lng=0° (prime meridian, +X axis).
 *  Returns a unit vector pointing FROM the Earth TOWARD the sun. */
export function sunDirection(hour: number): Vec3
/** Subsolar point — the (lat, lng) on Earth where the sun is directly overhead. */
export function subsolarPoint(hour: number): LatLng
/** ITCZ brightness for the currently visible front of the equator from a
 *  camera at +Z. Peaks when the sun is over lng ≈ 0; falls to 0 when sun
 *  is on the back of the globe. Returns 0..1. */
export function itczBrightness(hour: number): number
```

All exports are pure functions of `hour`. Heavily unit-tested:
- subsolar at h=12 is `(0, 0)`; at h=0 it is `(0, 180)`
- ITCZ brightness curves smoothly across the day, monotonic increasing
  from h=6 to h=12 and decreasing 12→18
- sunDirection at h=12 returns `[1, 0, 0]`, at h=18 returns `[0, 0, ±1]`
  (sign chosen to match the Z-negated lat/lng convention)

### 4.2 `sample.ts`

```ts
/** Derive atmospheric values at a point, given the current sun hour.
 *  Pure function — no globals, no IO. */
export function sampleAt(lat: number, lng: number, hour: number): InspectSample
```

Internal model (intentionally simple for v1):
- `tempC = 30 - 0.45 * |lat|` — base temperature falls 0.45°C per degree of
  latitude (~ -10°C at 90°). Modified by `+5°C` if the point is currently
  illuminated (i.e., dot product of point with sunDirection > 0.3),
  `-5°C` if on the night side.
- `pressureHpa`: three-zone latitude profile — 1008 at equator (low),
  1018 at ±30° (subtropical high), 1005 at ±60° (subpolar low), 1015 at
  poles. Smooth quadratic blend.
- `dewpointC = tempC - dewpointSpread(lat)` where spread is 4°C in the
  tropics, 12°C at mid-latitudes, 20°C at poles (cold dry).
- `lapseCPerKm = 6.5` always for v1 (the standard atmospheric lapse rate).
- Labels: `temp` → `'WARM' | 'MILD' | 'COOL' | 'COLD'`; `humidity` from
  dewpoint spread; `wind` from absolute latitude band (trade / westerly /
  polar verbal mapping).

### 4.3 `cellBands.ts`

```ts
export const CELL_BANDS: ReadonlyArray<CellBand> = [...]   // 6 bands, frozen

/** Build the world-space great-circle arc for a single arrow in a band.
 *  Returns N evenly-spaced 3D points along the arc on the unit sphere,
 *  suitable for THREE.CatmullRomCurve3 → TubeGeometry. */
export function arrowArcPoints(
  band: CellBand,
  longitudeIndex: number,    // 0..N-1, identifies which arrow in the ring
  totalAroundRing: number,   // ring density; defaults vary per band
  segments: number,          // arc resolution
): Vec3[]

/** Convenience: every arrow on every band, ready to mesh-build. */
export function allArrowArcs(): { band: CellBand; longitudeIndex: number; points: Vec3[] }[]
```

Ring densities (`arrowsAroundRing`) are defined per-belt in the `CELL_BANDS`
table: trade winds → 8 around the full ring (so ~4 visible on the front),
westerlies → 6 (~3 visible), polar easterlies → 4 (~2 visible). These
counts match the brainstormed mockup.

### 4.4 `atmosphereSlice.ts`

Standard Zustand-with-immer slice using the same pattern as
`src/tectonics/tectonicsSlice.ts`. No new patterns introduced.

## 5. Scene components

### 5.1 `<Atmosphere>`

Top-level R3F component that mounts only when `activeModule === 'atmosphere'`
in the persistent scene, returns `null` otherwise. Composes the four
sub-meshes plus the `HoverInspector`. No props.

### 5.2 `<Sun>`

Renders a `<directionalLight>` plus a small luminous sprite (sphere with
emissive material) at the position derived from `solar.sunDirection(hour) *
sunDistance`. Sun distance is far enough that the parallax reads as
"distant sun." Light's `target` points at the origin. Sprite renders with
additive blending and `depthWrite: false` so it composites cleanly against
the starfield. When `activeModule !== 'atmosphere'` the directional light is
still active (so Earth gets lit in all modules), but the sprite is hidden.

### 5.3 `<Heatmap>`

Additive sphere shell at radius 1.005. Custom `ShaderMaterial`:
- Vertex shader: standard MVP, passes through world-space position.
- Fragment shader: computes `phi = asin(pos.y)` (the latitude angle in
  radians), then maps `phi` to a color via a 5-stop ramp (red 0° →
  orange-yellow 30° → cyan 60° → blue 75° → deep blue 90°). Alpha modulated
  so the shell is mostly transparent except for the band colors. Uniform
  `uVisible` from store toggles alpha to 0 smoothly when the layer is off.

No per-frame updates; the heatmap is identical at every hour.

### 5.4 `<Cells>`

Builds `TubeGeometry` per arrow from `cellBands.allArrowArcs()`. Each band
produces one `BufferGeometry` with all its arrows merged (so one draw call
per band, six draw calls total). Material is a custom `ShaderMaterial`:

- A 1D dash pattern sampled from a uniform `uPhase` (advances linearly with
  `useFrame`'s delta) creates the scrolling-dash effect along each tube's
  length (encoded in the V coordinate of the tube's UV).
- Dash count and gap tuned to match the SVG mockup proportions.
- Color uniform per band (`#5cc6ff` trade, `#7ad9aa` westerly, `#aa8fff`
  polar).
- Arrowhead = a small `ConeGeometry` instance at each tube's end, oriented
  along the tangent at that endpoint. Solid color, no shader. Geometry
  ensures dashed stroke physically ends at the cone's base.
- `uVisible` uniform toggles alpha to 0 when the layer is off.

### 5.5 `<CloudBand>`

A thin volumetric band around the equator at radius 1.012. Implemented as
~80 billboarded sprite cards arranged in a ring at latitude 0°, each with a
soft cloud-puff texture. Material has a `uHour` uniform; the per-sprite
brightness is computed in the fragment shader as `itczBrightness(hour)`
modulated by the sprite's longitude proximity to the subsolar longitude
(brightest within ±30° of subsolar; fades to 0 over the next ±60°). This
makes the cloud band "follow the sun" without per-frame React updates.

### 5.6 `<HoverInspector>`

Invisible mesh — a slightly oversized sphere at radius 1.01 that intercepts
raycasts. On `pointerMove` (desktop) or `pointerDown` (touch), computes the
intersection point, converts to (lat, lng) via the inverse of
`latLngToVec3`, debounces 16ms, and dispatches `setInspectAt`. Hides the
visible cursor when over the globe, restores when off.

### 5.7 Integration

`src/scene/PersistentScene.tsx` gains one extra child:

```tsx
<Plates />
<Atmosphere />     // new
```

`<Atmosphere>` internally returns `null` for other modules, so it costs
nothing when not active.

## 6. UI components

### 6.1 `<AtmosphereBody>`

The module body wired into `MODULES.atmosphere.Body` in `src/shell/modules.tsx`.
Mounts `<ChipBar>`, `<Timeline>`, `<InspectReadout>`, and `<Legend>` in a
single `pointer-events-none` container with each child individually
re-enabling pointer events.

### 6.2 `<ChipBar>`

A horizontal row of three chips just above the scrubber. Each chip toggles
its layer (`store.toggleLayer`). On/off state styled with the atmosphere
accent color (active = filled accent, inactive = transparent with muted
border). Identical visual to the mockup chosen in brainstorming.

### 6.3 `<Timeline>`

A 24-hour scrubber. Visually mirrors `src/tectonics/ui/Timeline.tsx`'s
patterns — same horizontal track, draggable knob, click-anywhere-to-jump.
Track shows a gradient from deep midnight blue at 0:00, orange near sunrise
(6:00), warm yellow at noon (12:00), orange at sunset (18:00), midnight
blue at 24:00. Knob's position bound to `store.hour`. Continuous value
(not discrete steps).

### 6.4 `<InspectReadout>`

Top-left data block. Hidden when `inspectAt === null`. Renders three rows
whose content depends on `effectiveTier()`:

- **Beginner**: three large verbal labels (e.g., `WARM` / `BREEZY` / `HUMID`).
- **Standard**: three numerical lines (`22°C  · 1013 hPa  · 14°dp`) plus a
  small "40°N · 90°W · 14:00 local" line below.
- **Advanced**: Standard plus a fourth row showing lapse rate and specific
  humidity, plus a 60×40 px inline SVG vertical temperature profile
  (`T vs altitude`).

### 6.5 `<Legend>`

A small color legend in the top-right showing the three wind-belt colors
with their labels (Trade winds / Westerlies / Polar easterlies). Collapsed
by default into a single chevron-icon button; clicking expands inline.

## 7. Tutor prompts

Update `SUGGESTED_PROMPTS.atmosphere` in `src/ui/TutorPanel.tsx`:

```ts
atmosphere: [
  "Why do trade winds curve westward?",
  "What's the ITCZ?",
  "Why is the equator warmer than the poles?",
  "What drives the Hadley cell?",
]
```

No tutor backend wiring in this PR; the panel remains the existing stub.

## 8. Animation and time semantics

- Globe rotation: continuous autorotate at the same rate as Tectonics, via
  the existing `<OrbitControls autoRotate>` in `Scene`. Decoupled from `hour`.
- Sun position: driven entirely by `hour`. Changing the scrubber
  re-positions the `<Sun>`'s directional-light and sprite via
  `solar.sunDirection(hour)`.
- ITCZ brightness: driven by `solar.itczBrightness(hour)` and the per-sprite
  proximity to the subsolar longitude.
- Cell-arrow dash scroll: continuous, decoupled from `hour`. `useFrame`
  advances a single shared `uPhase` uniform; all arrows scroll in sync.
- Heatmap: completely static. No `useFrame`.

Reduced motion: when `prefers-reduced-motion` is set, the dash scroll
animation freezes (uPhase doesn't advance), and the sun's position
re-renders only on scrubber commit (not while dragging).

## 9. Layout summary

```
┌────────────────────────────────────────────────────────────┐
│  [InspectReadout]                          [Legend ▾]      │  ← top
│                                                            │
│                       ●  ← sun                             │
│                                                            │
│                                                            │
│                  ╭───────────╮                             │
│                 ╱             ╲                            │
│                ( EARTH GLOBE  )    ← cells + heatmap +    │
│                 ╲             ╱       clouds, all on        │
│                  ╰───────────╯                             │
│                                                            │
│                                                            │
│        [Cells] [Temperature] [Clouds]    ← floating chips  │
│  ─────●──────────────────────────  00:00 → 24:00          │  ← scrubber
│                                                            │
│                                  [Ask the tutor ●]         │  ← tutor
└────────────────────────────────────────────────────────────┘
```

## 10. Testing strategy

### 10.1 Pure-TS modules (strict TDD)

- `solar.spec.ts`: subsolar point at sentinel hours, brightness curve
  monotonicity, sun direction unit length.
- `sample.spec.ts`: temperature decreases monotonically with latitude;
  pressure profile has the three local minima at the expected latitudes;
  dewpoint never exceeds temperature; verbal labels match the numeric
  brackets at boundary values.
- `cellBands.spec.ts`: every band has the documented arrow count; arc
  points lie on the unit sphere within float tolerance; arrowhead tangent
  direction matches the tangent computed from the last two arc points.
- `atmosphereSlice.spec.ts`: toggleLayer is reversible, hour clamps to
  [0, 24), inspectAt round-trips.

Target: 100% line coverage of the engine files.

### 10.2 R3F + UI components

Same pragmatic policy as Tectonics: render with `@react-three/test-renderer`
for `Cells` / `Heatmap` smoke tests, verify mesh counts and uniform
defaults. UI components tested with `@testing-library/react` for the chip
toggles and tier-dependent readout branches.

### 10.3 Playwright e2e

`tests/e2e/atmosphere.spec.ts`:
- Navigate to /, click the Atmosphere card → assert URL is `/atmosphere`
- Scrubber drag changes the `hour` store value
- Toggling a chip removes its layer's accessibility role
- Hover over a known offset surfaces an `InspectReadout` line containing
  the expected temperature label for Standard tier

### 10.4 Visual approval gate

Before merging the PR, the user runs the dev server and approves the
finished atmosphere view by eye. No automated visual regression test; the
visual design has too many tunable knobs (heatmap colors, cloud puff
density, sun sprite glow) where a pixel diff would create more friction
than value.

## 11. Out of scope (intentional deferrals)

- **Axial tilt / seasons.** Locked equinox in v1. Adding tilt + season
  control is straightforward later (`solar.ts` takes a season parameter,
  `<Sun>` orbits in the tilted plane), but the visual scope balloons.
- **Real weather (fronts, storms, hurricanes, precipitation, pressure
  systems).** Out of scope by user choice. The day-cycle viewer surfaces
  *structure*, not dynamics.
- **Jet stream visualization.** Not v1.
- **Vertical column cross-section panel.** Considered (layout option C in
  brainstorming) and explicitly rejected — the Advanced-tier readout
  includes a tiny vertical temperature mini-graph instead.
- **Cloud volumetric raymarching** (DESIGN.md §3 mentions this as a
  visual-fidelity target). v1 uses billboard sprites; raymarched clouds
  can replace them in a later PR without changing the module's data model.
- **Tier-aware engine math.** Tier only affects the readout's verbal vs
  numeric presentation. The underlying physics values are the same.
- **AI Tutor wiring.** Tutor stays as the existing stub with updated prompts.
