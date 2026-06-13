# Earth Systems — Carbon-Cycle Sandbox — Design

**Status:** Approved for the first Earth Systems PR
**Date:** 2026-06-12
**Scope:** First PR of the Earth Systems module (DESIGN.md §2 Module C, §11 Phase 4 capstone)

## 1. Goals and constraints

Replace the `/systems` "Module under construction" placeholder with an **interactive carbon-cycle sandbox**. Carbon lives in four reservoirs — **atmosphere, ocean, biosphere, lithosphere**. The user pushes two human-driven forcing levers — **fossil-fuel emissions** and **land use** — and a mass-conservation engine integrates each reservoir's carbon forward in simulated time. The user watches the atmosphere fill and the lithosphere drain, with the natural carbon sinks (ocean, biosphere) fighting back.

This is the "interactive flux control" tier of ambition: a real system-dynamics ("bathtub") model, not a baked timeline. It is the thematic capstone of Strata's three modules — the crust (Tectonics) and the sky (Atmosphere) both feed the cycle shown here.

**Target misconception (DESIGN.md §2 Module C):** that carbon "disappears," or that cycles are instantaneous. The sandbox makes two things visceral: carbon is always conserved (it only *moves*), and the timescale mismatch between the fast atmosphere (~5 yr residence) and the colossal slow lithosphere (~millions of yr) is the engine of the climate story.

### Success criteria

1. Visiting `/systems` from the hub dollies the camera in and shows the four reservoirs on/around the persistent Earth, with a grouped gauge panel reading each reservoir's mass.
2. The user can drag two lever sliders — fossil-fuel emissions and land use — styled and interacting exactly like the Atmosphere `Timeline` track-and-knob.
3. Pressing **Play** advances simulated years continuously; reservoir masses evolve live and the gauges update. Dragging the fossil-fuel lever up and playing visibly **grows** the atmosphere gauge and **shrinks** the lithosphere gauge.
4. Carbon renders as glowing instanced particles flowing along the active fluxes; particle density/speed scales with flux magnitude; particle budget is tier-gated.
5. Three scenario presets (Pre-industrial / Present-day / High-emissions) seed starting masses and lever positions; **Reset** returns to the active scenario's seed.
6. The sidebar/gauge detail is tier-aware: Beginner shows qualitative gauges (no numbers), Standard shows GtC masses + flux rates, Advanced adds residence times and dM/dt.
7. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build` all pass.

### Inherited constraints from DESIGN.md

- **One persistent scene graph (§13.2)** — reservoir overlays render inside the existing `PersistentScene`, conditional on `activeModule === 'systems'`, exactly as `<Atmosphere>` / `<CloudBand>` do for the atmosphere module. No new Canvas, no scene scaffolding.
- **Reuse the Atmosphere scene + responsive patterns (explicit Chris directive).** The tilted, spinning `EarthFrame`, the `Sun`, bloom post-processing, the `CameraDolly` fit-to-viewport + mobile-portrait pan-up, and the `ModuleFrame` desktop-sidebar / mobile-floating-card handling (including the header-action slot) are all reused verbatim. Slider UX matches the Atmosphere `Timeline` grammar.
- **Mobile-first responsive layout (§7)** — desktop: left module card (levers) + right gauge panel + bottom scrubber. Mobile: panels fold into the bottom sheet; gauges become a compact row; camera pans Earth up above the card, as in Atmosphere.
- **Tier-aware UI (§1, §7)** — gauges, units, and lever labels adapt to `tierOverride`, reusing the pattern in `InspectReadout` / `TectonicsBody`.
- **Reduced-motion accessibility (§3, §13.5)** — when `prefers-reduced-motion: reduce`, playback does not auto-animate (matches Atmosphere `Timeline` / `PersistentScene` spin behavior); the user can still step/scrub manually and read gauges.
- **No backend in v1 (§1)** — all reservoir/flux constants and scenario seeds are bundled in client code.

---

## 2. File structure

All new code lives under `src/systems/`. A small number of existing files get edits to wire the module in.

```
src/systems/
  carbonModel.ts          # reservoir/flux constants, scenario seeds, types
  carbonModel.spec.ts     # constants + scenario sanity
  step.ts                 # pure forward-Euler integrator: step(state, dtYears)
  step.spec.ts            # mass conservation, equilibrium, lever response
  systemsSlice.ts         # Zustand slice: masses, levers, scenario, playing, elapsedYears
  systemsSlice.spec.ts    # actions + reducer behavior
  scene/
    Reservoirs.tsx        # halo/ocean/biosphere/interior visuals driven by masses
    CarbonFlows.tsx       # instanced glowing particles along active fluxes
  ui/
    SystemsBody.tsx       # module card: intro, lever sliders, scenario presets
    LeverSlider.tsx       # track-and-knob slider (Atmosphere Timeline grammar)
    ReservoirGauges.tsx   # grouped 4-reservoir gauge panel
    SystemsTimeline.tsx   # playback scrubber (play/stop + elapsed-years track)
```

Existing files edited:

- `src/store/index.ts` — compose `createSystemsSlice` into the `Store` type and the returned object, alongside the existing shell/tectonics/atmosphere slices.
- `src/scene/PersistentScene.tsx` — render `<Reservoirs />` + `<CarbonFlows />` inside the spinning `EarthFrame` (or at scene root where world-space is required), gated on `activeModule === 'systems'`.
- `src/shell/modules.tsx` — replace the `systems` stub `Body` with `SystemsBody`; keep the existing `dolly` (pulled-back framing) or tune `fillRatio`.
- `tests/e2e/` — add `systems.spec.ts` mirroring `atmosphere.spec.ts`.

---

## 3. Simulation engine (`src/systems/`, pure TS)

### 3.1 State

```ts
type ReservoirKey = 'atmosphere' | 'ocean' | 'biosphere' | 'lithosphere'
type Masses = Record<ReservoirKey, number>   // GtC

interface SystemsState {
  masses: Masses
  fossilLever: number   // 0..1 → 0..MAX_FOSSIL GtC/yr (lithosphere → atmosphere)
  landLever: number     // -1..1 → reforestation .. deforestation (biosphere ↔ atmosphere)
  elapsedYears: number
}
```

### 3.2 Reservoir baseline masses (GtC, pre-industrial-ish)

| Reservoir | Mass (GtC) | Note |
| --- | --- | --- |
| Atmosphere | 590 | pre-industrial baseline; present-day seed ≈ 870 |
| Ocean | 38,000 | dissolved inorganic carbon |
| Biosphere | 2,000 | vegetation + soil |
| Lithosphere | 75,000,000 | rocks, sediments, fossil fuels |

These are textbook round figures, scientifically honest but not research-grade (DESIGN.md §12). They are display + integration constants only.

### 3.3 Fluxes (GtC/yr)

**Natural fluxes** run automatically every tick. Each is anchored to a baseline value (the figures from §1's model: photosynthesis/respiration ≈120, air–sea exchange ≈90, volcanism/weathering ≈0.1). The **uptake** fluxes are *responsive* — they grow when their source reservoir holds excess carbon, giving the system negative feedback so the atmosphere doesn't accumulate unbounded. Responsiveness uses a **tunable sensitivity coefficient `k` (0 < k ≤ 1)** on the fractional excess, *not* a full linear scaling, so the perturbation relaxes over a realistic multi-decade timescale rather than snapping back in a few years:

```
excess_atm = M_atm / ATM_BASELINE − 1
F_photo = 120 * (1 + k_photo * excess_atm)     // atmosphere → biosphere (CO₂ fertilization)
F_a2o   = 90  * (1 + k_ocean * excess_atm)     // atmosphere → ocean uptake
F_resp  = 120 * (M_bio / BIO_BASELINE)         // biosphere → atmosphere (tracks biosphere size)
F_o2a   = 90                                    // ocean → atmosphere (baseline outgassing)
F_volc  = 0.1                                   // lithosphere → atmosphere (constant)
F_weather = 0.1                                 // atmosphere → lithosphere (constant slow return)
```

The exact `k_photo`/`k_ocean` values are tuned during implementation so that a present-day-magnitude perturbation relaxes on a decades-to-century scale (consistent with a realistic airborne fraction), not in a few years. The plan fixes concrete starting values; tests assert *behavior*, not exact coefficients (see §6).

**Equilibrium property:** at the pre-industrial baseline masses with levers at zero, `excess_atm = 0`, so every responsive flux equals its baseline and all four reservoirs have zero net flux. Pre-industrial is therefore an exact equilibrium regardless of the chosen `k` values — verified in tests. (The present-day and high-emissions scenarios seed an elevated atmosphere *on purpose*, so they start out of equilibrium and visibly evolve when played.)

**Lever fluxes:**

- Fossil-fuel emissions (lithosphere → atmosphere): `F_fossil = fossilLever * MAX_FOSSIL`, `MAX_FOSSIL = 12`.
- Land use (biosphere ↔ atmosphere): `landLever > 0` → deforestation flux `landLever * MAX_LAND` (biosphere → atmosphere); `landLever < 0` → reforestation flux `|landLever| * MAX_LAND` (atmosphere → biosphere); `MAX_LAND = 4`.

### 3.4 Integration

`step(state, dtYears)` computes all fluxes from current masses + levers, then applies forward Euler:

```
dM_r = (Σ inflows to r − Σ outflows from r) * dtYears
M_r' = max(0, M_r + dM_r)
```

Default `dtYears` per playback tick is small enough for stability (e.g. 0.25–0.5 yr per integration sub-step; playback rate maps wall-clock seconds → sim-years like Atmosphere's `SECONDS_PER_HOUR`). The `max(0, …)` floor guards against a reservoir going negative under an extreme lever; because levers are bounded and dt is small this is a safety rail, not a routine clamp.

**Invariant (headline test):** every flux moves carbon *between* the four reservoirs — none enters or leaves the system. Therefore `sum(masses)` is constant to floating-point tolerance across any lever sequence and any number of `step` calls. The `max(0, …)` floor is the only thing that could break this; tests assert it never triggers within the valid lever/dt envelope, so conservation holds exactly.

### 3.5 Scenario seeds

```ts
const SCENARIOS = {
  'pre-industrial': { masses: {atmosphere: 590, …}, fossilLever: 0, landLever: 0 },
  'present-day':    { masses: {atmosphere: 870, …}, fossilLever: 0.75, landLever: 0.25 },
  'high-emissions': { masses: {atmosphere: 870, …}, fossilLever: 1.0,  landLever: 0.5  },
}
```

Reset re-seeds masses + levers + `elapsedYears = 0` from the active scenario.

---

## 4. 3D scene

Rendered conditionally when `activeModule === 'systems'`, inside `PersistentScene`. Inherits the tilted spinning Earth, Sun, bloom, camera dolly + mobile pan — no new scaffolding.

- **Atmosphere reservoir** → the fresnel atmospheric-rim halo's intensity/thickness is driven by `M_atmosphere` (normalized against a display range), so a CO₂-loaded atmosphere visibly thickens the blue rim.
- **Ocean reservoir** → ocean surface tint brightness scales with `M_ocean` (subtle — ocean barely changes in fraction, but the gauge carries the precise read).
- **Biosphere reservoir** → land/vegetation green tint scales with `M_biosphere` (deforestation visibly dulls it).
- **Lithosphere reservoir** → a warm interior emissive glow whose intensity tracks `M_lithosphere` (drains as fossil fuel is burned).
- **Carbon flows** → `CarbonFlows.tsx` renders instanced glowing particles streaming along each active flux path: surface↔halo for air–sea and photosynthesis/respiration, up from the interior for volcanism and fossil-fuel. Per-flux particle count and speed scale with that flux's current magnitude. Total particle budget is tier-gated, reusing the existing tier-preset system (`mobile-lite` reduced counts, `desktop-ultra` full).

Reservoir visual mappings use clamped display-normalization helpers (pure functions, unit-tested) so a runaway mass can't blow out a material parameter.

---

## 5. UI

Layout 2 (grouped reservoir panel), Atmosphere grammar throughout.

- **Left module card** — `SystemsBody` mounted in `ModuleFrame` (desktop left sidebar / mobile floating bottom card above the scrubber). Contains: module intro copy, the **two lever sliders**, and the **scenario preset buttons** (the Atmosphere season-chip pattern). Reset button.
- **Lever sliders** — `LeverSlider.tsx`, a track-and-knob control built on the Atmosphere `Timeline` interaction grammar: rounded track, glowing accent knob, pointer-drag + click-to-set, `role="slider"` with `aria-valuemin/max/now` and a text label. Fossil-fuel lever 0→max (orange/red accent); land-use lever bipolar reforestation↔deforestation (green↔orange) with a centered zero.
- **Reservoir gauge panel** — `ReservoirGauges.tsx`, four stacked gauges (bar + value), color-coded per reservoir (atmosphere `#5CC6FF`, ocean `#6FA8FF`, biosphere `#7AD9AA`, lithosphere `#FF8C5A`), live-updating from the slice. Desktop: right-side panel. Mobile: folds into the bottom sheet as a compact row (or into the card header-action slot, matching the Atmosphere chip relocation).
- **Playback scrubber** — `SystemsTimeline.tsx`, the `Timeline` component pattern: play/stop button + an elapsed-years track + a readout (e.g. "Year +42"). Play advances sim-years continuously via `requestAnimationFrame`, calling `step` and writing masses to the slice. Open-ended sandbox: it runs forward until stopped or reset (no fixed end year). Reduced-motion → no auto-advance; manual only.
- **Tier behavior** — Beginner: qualitative gauges ("CO₂ rising fast", arrows), no numbers, levers labeled plainly ("Burn fossil fuels", "Cut/plant forests"). Standard: GtC masses + flux rates, proper terms. Advanced: + residence times and dM/dt per reservoir. Same `tierOverride` + post-hydration-mount guard as `InspectReadout`.

---

## 6. State, persistence, testing

- **State** — `createSystemsSlice` adds `masses`, `fossilLever`, `landLever`, `scenario`, `playing`, `elapsedYears`, plus actions: `setFossilLever`, `setLandLever`, `setScenario` (re-seeds), `togglePlaying`, `tick(dtYears)` (calls `step`, writes masses + elapsedYears), `reset`. Mirrors the `atmosphereSlice` shape.
- **Persistence** — none. The store only persists shell fields (`tierOverride`, `activeModule`, `highContrast`) to localStorage; the `atmosphereSlice` and `tectonicsSlice` sim state are in-memory, and `systemsSlice` matches that — reservoir masses and levers reset on reload. No change to the persistence layer is required.
- **Testing**
  - Vitest, engine: mass-conservation invariant across random lever sequences and many ticks; Pre-industrial equilibrium stability (no drift at zero levers, any `k`); negative-feedback behavior (an elevated-atmosphere start with zero levers relaxes *toward* baseline over time — sinks absorb the excess); lever-response direction (fossil up ⇒ atmosphere↑, lithosphere↓; reforestation ⇒ atmosphere↓, biosphere↑); scenario seeds match table; display-normalization helpers clamp.
  - Vitest, slice: actions mutate as expected, `setScenario` re-seeds, `tick` advances `elapsedYears`.
  - Playwright e2e (`systems.spec.ts`, mirrors `atmosphere.spec.ts`): `/systems` renders chrome + canvas with no unexpected console errors; dragging a lever changes a gauge value; scenario switch + reset; gauges/scrubber are absent on the hub (module isolation).

---

## 7. Out of scope for this PR

- The ocean's internal surface/deep split, soil-vs-vegetation split, or any reservoir beyond the four (DESIGN.md §2 names exactly four).
- Additional levers (ocean-uptake rate, volcanism) — deferred; natural fluxes run automatically.
- ppm/temperature conversion or any climate-response model beyond carbon mass (no radiative forcing → °C in v1).
- A fixed historical timeline / baked scenario data (the engine is live integration, not lookup).
- Tutor prompt content tuning beyond wiring the existing panel (suggested prompts can be a fast follow).

---

**End of design document.**
