# Strata — Design Document

**Status:** Approved design for v1 · **as-built state tracked in §14**
**Date:** 2026-05-24 (design) · last reconciled with code 2026-06-19
**Host:** strata.chriswest.tech
**Sibling project:** Molecular (`github.com/inkorange/molecular`, molecular.chriswest.tech)

> **Reading this doc:** §1–§13 are the original approved design intent. Where the
> shipped product diverges from that intent — and it does, deliberately, for the
> three modules — **§14 (Implementation Notes — As Built)** is the source of
> truth. Start there for what actually exists today: the per-era continent
> rendering pipeline, and each module's real control surface (including the
> Atmosphere season selector).

> Strata is the earth-science counterpart to Molecular. It deliberately reuses
> Molecular's design language, tier system, stack, and component grammar so the
> two read as a matched set in the inkOrange portfolio. Where Molecular runs
> three *modes* (Explore / Build / Lab) against one domain, Strata runs three
> *domains* (Tectonics / Atmosphere / Earth Systems) under one shell, each domain
> carrying Molecular's three-tier depth model. Strata is specifically about the
> planet itself — its crust, its sky, and the cycles that move between them.
> (Earth-sun-moon astronomy is intentionally excluded; it lives in a separate app
> alongside the inkOrange space suite.)

---

## 1. Goals & Audience

**One-line:** A 3D web app where students manipulate the forces that shape the
Earth — drifting plates, forming weather, cycling carbon — rendered with
realistic, game-quality visuals in a cause-and-effect-aware space.

**Tiers** (one product; UI scales with the user — same model as Molecular):

- **Beginner** — middle / early-high-school. Default. Qualitative only: no
  numbers, friendly tutor register, one variable in play at a time, full element
  names / plain labels.
- **Standard** — high school / earth science. Real units appear (cm/yr, hPa,
  gigatonnes), multiple variables interact, labels use the proper terms
  (convergent boundary, dew point, residence time).
- **Advanced** — AP / college intro. Reveals the underlying model: stress and
  strain at boundaries, adiabatic lapse rates, flux equations. Tutor uses precise
  terminology.

This three-tier model replaces what an earlier sketch called an "Explore/Analyze
toggle." Molecular already solved the wide-grade-band problem with three tiers;
Strata inherits it verbatim so the projects share the control.

**Success criteria for v1:**

1. A first-time visitor lands on the homepage and watches at least one full
   autonomous earth-process cycle (a plate collision raising a mountain range)
   before clicking through.
2. A student can form all three plate-boundary types and see the resulting
   landform in under 2 minutes with no instruction.
3. A student can scrub geologic time and watch a mountain range rise and erode.
4. The AI tutor can answer "why did this happen?" given the current scene state.
5. Hits its tiered fidelity targets (see §3): 60fps photoreal on a capable
   desktop GPU, 30fps and good-looking on a mid-range phone. The homepage hero
   shows a static or low-cost first paint immediately, then streams in the
   heavier 3D assets — TTI for *interactivity* ≤ 2.5s on Fast 4G, with full
   high-fidelity assets allowed to arrive progressively after.

### Design principles (inherited from Molecular)

- **Mobile-first.** Phone-sized touch viewport first; widen to tablet/desktop.
- **Demonstrate by doing.** The homepage reel and module previews use the same
  components the user interacts with. No marketing-only animations.
- **Pedagogy is the polish.** Every visible affordance teaches — the time
  scrubber, the boundary-type colors, the tutor.
- **No backend in v1.** Everything works offline once loaded except the tutor.

---

## 2. Core Experiences

The shell is the product. One persistent frame; three domain modules plug in. The
3D viewport is the canvas; sidebar + inspector wrap it, exactly as Molecular.

### Shell / hub (route `/`)

The connective tissue is a translucent rotating **Earth** — the direct analog of
Molecular's translucent nucleus, an object you see *into* (crust, mantle, core
layers visible). Three entry points zoom the camera to a different scale:

- **Tectonics** → dolly into the crust
- **Atmosphere** → pull out to the sky layer
- **Earth Systems** → overlay the cycles onto the globe

The zoom-to-enter metaphor is what makes three simulators read as one app. It is
the single most important thing to get right in v1, the way Molecular's first job
was rendering one atom beautifully.

### Module A — Tectonics (the crust)  ◄ recommended v1 flagship

Drag plates to form **convergent** (mountains, trenches, volcanoes),
**divergent** (rifts, seafloor spreading), and **transform** (earthquakes along
the fault) boundaries. A **geologic-time scrubber** compresses millions of years
into a slider; uplift and erosion play out along it. The Inspector shows the
active boundary type and (Standard+) plate velocities and earthquake magnitudes.

- **Target misconception:** that landforms are static / the map always looked
  this way. Cause-and-effect is invisible in textbook cross-sections.
- **Why flagship:** genuine market gap, most dramatic payoff of the three.

### Module B — Atmosphere (the sky)

Adjust **temperature, pressure, humidity**; form fronts, clouds, precipitation;
connect air-mass interactions to real weather. Standard+ surfaces hPa, dew point,
lapse rates.

- **Target misconception:** weather is random / disconnected from physical drivers.

### Module C — Earth Systems (the cycles)

Move **carbon** between reservoirs (atmosphere, ocean, biosphere, lithosphere);
watch fluxes and timescales; connect to climate. Standard+ surfaces reservoir
mass in gigatonnes, flux rates, residence times.

- **Target misconception:** carbon "disappears" / cycles are instantaneous.
- **Note:** thematic capstone — the crust and sky both feed the cycles.

### Cross-cutting features (all modules)

- **AI Tutor** (collapsible right sheet; bottom drawer on mobile) — context-aware
  of the current scene. Suggested prompts change per module.
- **Tier toggle** — Beginner / Standard / Advanced controls units shown, label
  verbosity, variable count, tutor register.
- **Time scrubber** — where a module has a temporal dimension (tectonics,
  systems).
- **Share** — current scene state → compact URL hash, loaded via `/s/[hash]`.
- **Undo / Redo** — immer patch history.

### Landing page reel

Fullscreen R3F canvas, autonomous process reel anchored off-center, ~8 s/cycle:
plate collision raising a range → a cold front rolling through with cloud
formation → carbon pulsing between reservoirs → loop. Uses the same components as
the modules (demonstrate-by-doing). `prefers-reduced-motion` and mobile fall back
to a single rest state with slower cadence, no bloom.

---

## 3. Visualization System

### Visual fidelity target

Strata aims higher than Molecular's stylized look. The bar is **modern real-time
video-game quality** — physically-based rendering, cinematic lighting, and
motion that feels produced rather than schematic. This is the project's headline
differentiator and the reason a viewer stops scrolling. The look is *realistic*,
not cartoon: real materials, real light, real atmosphere.

This ambition collides head-on with mobile-first performance, so fidelity is
**tiered by device**, never a single setting (see §6 and §12):

- **Desktop / capable GPU (`desktop-ultra`):** the showcase tier. Full PBR
  materials (albedo + normal + roughness + metalness + AO maps), real-time soft
  shadows, atmospheric scattering / volumetric light, screen-space ambient
  occlusion, bloom + tone mapping (ACES filmic), depth of field on the hub,
  GPU particle systems. Target 60fps at 1080p.
- **Mid laptop / tablet (`balanced`):** PBR materials kept, shadows simplified
  (baked or single-cascade), volumetrics dropped to billboard fog, SSAO off,
  bloom kept. Target 45–60fps.
- **Phone (`mobile-lite`):** the honest fallback. Simplified materials, no
  real-time shadows, no volumetrics, baked lighting, reduced particle counts,
  bloom optional by device. Target 30fps. *Realism degrades gracefully here —
  the phone build is good-looking and smooth, not photoreal.*

The spec does **not** promise photoreal on a phone; that's the one thing modern
web 3D genuinely cannot do well, and pretending otherwise produces a janky build.
Desktop is where the game-quality claim lives; mobile stays playable.

### The Earth (hub object)

The portfolio "wow" object — the role Molecular's swirling-electron nucleus
plays, but pushed to realism. A photoreal layered globe: a true PBR surface
(albedo, normal, specular/roughness, night-lights emissive, animated cloud layer
above the surface), a **fresnel-based atmospheric rim** with Rayleigh-style
scattering for the blue halo and sunset terminator, and — on `desktop-ultra` — a
cutaway revealing crust / mantle / outer-core / inner-core as distinct
realistically-shaded shells you can see into. Subtle auto-rotation, parallax
starfield behind, ACES tone mapping over the whole frame.

### Per-module objects

- **Tectonics:** plates as PBR-textured crust with real rock/terrain materials
  (displacement-mapped surface, not flat slabs). Boundaries render active geology
  with deforming geometry — fold mountains extrude and crumple, rift valleys
  split with exposed strata, trench subduction animates with one plate visibly
  sliding under another. Earthquakes trigger a screen shake, a shockwave ripple
  across the surface, and debris particles. Magma glows emissively at divergent
  ridges. On `desktop-ultra`, real-time shadows from the raised terrain.
- **Atmosphere:** true volumetric clouds (raymarched on `desktop-ultra`,
  billboard-fog on lower tiers), god-rays / light shafts through breaks in cover,
  GPU rain and snow particles with motion blur, lightning flashes lighting the
  cloud volume from within, animated front boundaries as moving weather systems.
- **Earth Systems:** reservoirs as realistically-lit translucent volumes
  (subsurface scattering feel), carbon as glowing GPU particle flows that surge
  and slow with flux rate, smooth eased transitions when matter moves between
  reservoirs.

Animation principle across all modules: motion is **eased, weighty, and
continuous** (game-feel), never linear or snappy. Camera moves are dolly/orbit
with inertia; state changes tween over 400–800ms; idle scenes have subtle
ambient motion so nothing ever looks frozen.

### Scene backdrop & post-processing

Color identity stays inherited from Molecular (the dark cosmic palette is the
family signature), but the rendering is richer:

- Deep-space gradient base: `radial-gradient(circle at 50% 50%, #1a1135 0%, #07051a 100%)`
- Theme color `#07051a`
- drei `<Stars>` parallax for depth
- **Post-processing chain** (`@react-three/postprocessing`, tier-gated): ACES
  filmic tone mapping always on; bloom always on; SSAO, depth of field, and
  subtle chromatic aberration / vignette on `desktop-ultra` only. The tone-mapped
  HDR-style look is a big part of what reads as "game-quality" versus "web demo."

### Reduced-motion / accessibility

Same as Molecular: `prefers-reduced-motion` freezes ambient motion and makes
transitions instant; a high-contrast toggle swaps the moody palette for solid
saturated colors with thicker outlines and no bloom.

---

## 4. Simulation Engines (pure TypeScript, unit-tested)

Each module gets a pure-TS engine, no DOM, mirroring Molecular's `src/chem/`:

- **`src/tectonics/`** — boundary classification from relative plate motion,
  uplift/erosion model over geologic time, earthquake placement, feature
  generation (mountain / rift / trench).
- **`src/atmos/`** — air-mass interaction, front formation, condensation from
  temp/pressure/humidity, simple lapse-rate model.
- **`src/systems/`** — reservoir masses, flux rates between reservoirs, residence
  time, mass conservation across the cycle.

Each exposes a small typed API and a `validate(state)` analog where a module has
a notion of valid/invalid configuration. Bulk of unit coverage lives here, like
Molecular's exhaustively tested chem engine.

---

## 5. Data Model & State

**Zustand + immer**, same slice pattern as Molecular:

- `sceneSlice` — per-module simulation state; mutations emit immer patches.
- `uiSlice` — panels, drawers, drag/scrub in progress.
- `tutorSlice` — message history, streaming state, suggested prompts.
- `historySlice` — undo/redo patch stacks.
- `shellSlice` — active module, camera zoom target, tier.

**Persistence** (no backend, same as Molecular): `localStorage` for current scene
(debounced 1 s), saved configurations, and settings (tier, reduced-motion
override, high-contrast). **URL hash** via `base64url(deflate(JSON))` loaded on
`/s/[hash]`.

---

## 6. R3F Scene Architecture

Same core stack as Molecular, extended for fidelity:

- `@react-three/fiber` — declarative scene graph
- `@react-three/drei` — `OrbitControls`, `Stars`, `Billboard`, `Text`,
  `Environment` (HDRI/IBL lighting), `useTexture` (PBR map sets),
  `MeshReflectorMaterial`, `Cloud` / volumetric helpers
- `@react-three/postprocessing` — bloom, ACES tone mapping, SSAO, DOF, vignette
  (tier-gated)
- `@react-three/rapier` — physics, lazy-loaded only where a module needs it
- Custom GLSL shaders where stock materials fall short — atmospheric scattering
  on the globe, raymarched volumetric clouds on `desktop-ultra`

**Lighting model:** image-based lighting via an HDRI environment map for
realistic reflections and ambient, plus a key directional "sun" casting real-time
shadows on capable tiers. This IBL setup is the single biggest lever for the
materials reading as real rather than flat-shaded.

**Performance levers:** device-tier detection on boot
(`matchMedia('(pointer: coarse)')`, `hardwareConcurrency`, `deviceMemory`,
optional WebGL renderer-string sniff) selects `desktop-ultra` / `balanced` /
`mobile-lite`, each a full preset of material complexity, shadow resolution,
post-processing passes, and particle budgets. Plus: instanced particles, LOD on
distant geometry, texture compression (KTX2/Basis) to keep PBR map sets off the
bundle-size cliff, and lazy-loaded HDRIs.

**Note on `frameloop`:** Molecular's `frameloop="demand"` (render only on change)
saves battery but is incompatible with continuous ambient motion and volumetrics.
Strata runs a **continuous loop on `desktop-ultra`/`balanced`** (the visuals are
always alive) and may drop to `demand` on `mobile-lite` when a scene is idle to
protect battery. This is a deliberate divergence from Molecular.

---

## 7. UI & Palette

### Layout (mobile-first, three breakpoints — identical to Molecular)

- **Mobile (< 720px):** full-screen viewport; bottom drawer (peek shows the
  module's status bar + tier + module switcher, drag up for controls); top sheet
  for the tutor; FAB for Save/Share; 44×44px min hit targets.
- **Tablet (720–1100px):** drawer becomes a pinnable left sheet; tutor moves to a
  right sheet.
- **Desktop (≥ 1100px):** three persistent panels — left sidebar (module
  controls), center viewport (with bottom status strip), right inspector
  (selection metadata + tutor entry).

### Base palette & typography

The foundational color ramp and font stack are **not defined here** — they are
ported verbatim from the Molecular repo per the directive in §13.1. This section
only defines what Strata *adds* on top of that base: the domain accents below.

### Domain accent colors (Strata's analog to Molecular's category palette)

| Domain | Accent | Token | Mnemonic |
| --- | --- | --- | --- |
| Tectonics | `#FF8C5A` (magma orange) | `--accent-tectonics` | heat of the crust |
| Atmosphere | `#5CC6FF` (sky blue) | `--accent-atmosphere` | matches Molecular's nonmetal blue |
| Earth Systems | `#7AD9AA` (biosphere green) | `--accent-systems` | matches Molecular's metalloid green |

Atmosphere and Earth Systems deliberately reuse Molecular's exact accent hues so
the palettes are visibly cousins; magma orange is the one new note, and it
doubles as an inkOrange brand wink. These three are additive tokens layered onto
the ported Molecular base — they never replace it.

---

## 8. AI Tutor

Single Next.js Server Action → **Vercel AI Gateway** → Anthropic, same as
Molecular. Payload carries a compact scene snapshot, active module, tier, and the
user question or a suggested prompt. **Model selection by tier:** Beginner →
`anthropic/claude-haiku-4-5`; Standard / Advanced → `anthropic/claude-sonnet-4-6`.
Streaming via AI SDK `streamText`. Supports "highlight" tool calls that pulse the
referenced scene object (a plate, a front, a reservoir) when clicked. Anonymous
rate limit ~20 msgs/hour by IP at the Gateway, no auth.

Suggested prompts per module, e.g. Tectonics: "Why did a mountain form here?" ·
"What makes earthquakes happen at this boundary?" · "What will this look like in
10 million years?"

---

## 9. Tech Stack (match Molecular exactly)

- **Framework:** Next.js 16 (App Router) on Node 24 LTS, pnpm 9
- **3D:** Three.js + `@react-three/fiber` + `drei` + `postprocessing` + `rapier` (lazy)
- **UI:** Tailwind CSS + shadcn/ui
- **State:** Zustand + immer
- **Validation:** Zod (share-link payloads, tutor responses)
- **AI:** Vercel AI SDK v6 + Vercel AI Gateway (Haiku + Sonnet by tier)
- **Testing:** Vitest (unit) + Playwright (e2e, mobile-chrome primary + desktop)
- **Lint/format:** Biome
- **Deploy:** Vercel, inkOrange team (`team_H6LlOofXMSjnfKENSnEmpgMY`), Fluid
  Compute for the tutor route
- **Telemetry:** Vercel Analytics + Speed Insights

---

## 10. File Structure (parallels Molecular)

```
strata/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx                # Hub: layered Earth + reel + module cards + footer
│  ├─ app/page.tsx            # Active module: <Scene/> + <Sidebar/> + <Inspector/>
│  ├─ api/tutor/route.ts      # AI tutor streaming endpoint
│  ├─ s/[hash]/page.tsx       # Shared scene loader
│  └─ globals.css
├─ src/
│  ├─ shell/                  # Hub, zoom-to-enter, module frame, tier toggle
│  ├─ scene/                  # Shared R3F: Scene, Earth, Stars, bloom, ScrubTimeline
│  ├─ tectonics/              # engine (pure TS) + module R3F + UI
│  ├─ atmos/                  # engine + module R3F + UI
│  ├─ systems/                # engine + module R3F + UI
│  ├─ store/                  # Zustand slices (scene, ui, tutor, history, shell)
│  ├─ ui/                     # shared shadcn-based 2D UI
│  ├─ landing/                # homepage reel + hero + module cards
│  ├─ hooks/
│  └─ lib/                    # shareUrl, persistence, palette
├─ public/
├─ tests/                     # vitest engine specs + playwright e2e
├─ next.config.ts
├─ tailwind.config.ts
├─ biome.json
└─ package.json
```

---

## 11. Build Order (resist building all three at once)

0. **Establish the render pipeline first (realism-first, per §13.3).** Before any
   module logic: stand up the lighting model (HDRI/IBL + key sun), the PBR
   material workflow, the tier-preset system, the post-processing chain, and the
   continuous render loop. Prove it on the hub Earth at full `desktop-ultra`
   fidelity — photoreal globe, atmospheric rim, animated clouds — until it looks
   right. Everything downstream depends on these foundations, and they're
   expensive to retrofit, so they come first.
1. **Shell + hub.** The realistic layered Earth from step 0, plus zoom-to-enter
   (true camera dolly, per §13.2), module frame, tier toggle, tutor panel wired
   with one stub module behind it. This is the ship-blocker, same role the
   homepage reel played for Molecular.
2. **Tectonics fully.** It's both the flagship and the natural v1 anchor — the
   biggest market gap and the most dramatic payoff. Build it end to end: plate
   dragging, the three boundary types, the geologic-time scrubber, the tutor
   wired to scene state. A polished Tectonics module alone is a shippable,
   demoable product.
3. **Atmosphere second**, reusing every shell primitive (frame, tier toggle,
   tutor, share, time controls where relevant).
4. **Earth Systems third** as the thematic capstone tying crust and sky together.
5. **Teacher demos + Reddit/launch** once two modules are solid (reuse the
   reddit-promoter skill and Molecular's demo-page pattern).

---

## 12. Out of Scope for v1

- User accounts, community gallery, teacher dashboards (localStorage + hash only)
- Guided lesson sequences (defer to v2 once we see where students get stuck)
- More than the three core modules (Astronomy is a separate app, by design)
- Quantitative rigor beyond each module's v1 model (no full GCM, no finite-element
  tectonics — the *simulation math* is simplified, though the *rendering* is not;
  models are scientifically honest but not research-grade)
- VR / AR; export to image / file

---

## 13. Resolved Decisions

These were open questions during design; all are now settled. Recorded here so
the rationale survives.

1. **Theme tokens — port directly from the Molecular repo.** Strata reuses
   Molecular's font stack and shadcn color ramp so the two are visibly one family.

   > **Directive to the implementer:** the Molecular repo is available locally
   > alongside this project. Do not guess or approximate these values — read them
   > from source and port them verbatim. Specifically:
   >
   > 1. Open Molecular's `app/globals.css`. Copy the full set of CSS custom
   >    properties — the shadcn token ramp (`--background`, `--foreground`,
   >    `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`,
   >    `--border`, `--input`, `--ring`, the chart vars, and both `:root` and
   >    `.dark` blocks) plus any `--radius` and `--font-*` variables — into
   >    Strata's `app/globals.css`. If the project is Tailwind v4, this includes
   >    the `@theme` / `@theme inline` block.
   > 2. Open Molecular's `app/layout.tsx` (or wherever fonts are configured) and
   >    replicate the exact `next/font` setup — same families, weights, subsets,
   >    and CSS variable bindings.
   > 3. Copy `components.json` so shadcn generates components with identical
   >    styling conventions (base color, CSS-variable mode, aliases).
   > 4. Keep these confirmed anchors intact, as they are already referenced
   >    throughout this doc: theme color `#07051a`; backdrop gradient
   >    `radial-gradient(circle at 50% 50%, #1a1135 0%, #07051a 100%)`.
   > 5. Then extend — do not replace — the ported ramp with Strata's three domain
   >    accent tokens from §7 (`--accent-tectonics: #FF8C5A`,
   >    `--accent-atmosphere: #5CC6FF`, `--accent-systems: #7AD9AA`). These are
   >    additive; the Molecular base palette stays the foundation.
   >
   > The goal: a fresh Strata page with no module content should be
   > indistinguishable from Molecular in typography, spacing, and chrome color.
   > Divergence starts only at the domain accents and the 3D content.

2. **Hub zoom — true camera dolly.** When entering a module the camera physically
   flies into one continuous Earth (into the crust for Tectonics, out to the sky
   for Atmosphere, onto the surface cycles for Earth Systems). No crossfade
   fallback — the dolly is the soul of the "one app" concept and we commit to it.
   This means one persistent scene graph with careful LOD on the globe so it holds
   up both far and near, and shared-world memory management.

3. **Realism-first — invest upfront, no staging.** We do *not* build a `balanced`
   baseline and add fidelity later. We target the realistic, game-quality look
   from the first commit. Rationale: past experience shows that retrofitting
   realism onto a simpler base costs more than building it right initially —
   material pipelines, lighting, and the render loop are foundational and
   expensive to change once modules depend on them. The tiered presets from §3
   (`desktop-ultra` / `balanced` / `mobile-lite`) still exist as runtime
   *degradation* targets, but development starts at the top tier so the
   architecture is built for it from day one.

4. **Assets — non-paid only.** PBR map sets, HDRI environment maps, and
   cloud/particle textures come from CC0 / non-paid libraries (Poly Haven,
   ambientCG) and the inline Cloudflare imagegen skill for custom maps. Chris will
   supply specific assets where needed. No paid marketplace dependencies. KTX2 /
   Basis compression is mandatory from day one — asset weight, not code, is the
   real bundle threat.

5. **inkOrange "labs" index — deferred.** Strata, Molecular, and the space suite
   stay separate sites for now, sharing only a visual language. A unifying hub is
   a possible later project, not part of Strata v1. Build Strata's footer and
   branding so they won't fight a future federation, but add nothing for it now.

6. **Name & host — Strata, at `strata.chriswest.tech`.** Confirmed. Single
   evocative noun in the Molecular mold; implies layers and depth; reads well
   lowercase as a logo.

---

## 14. Implementation Notes — As Built (v1)

This section records what actually shipped, where it diverges from the §1–§13
intent, and the technical specifics that aren't obvious from the design alone.
The headline divergence: the three modules landed as **observe-and-scrub
viewers** built around a shared scene + timeline + tier grammar, not the
free-form "drag to build" sandboxes the early design sketched. Each module gives
the user a small, well-chosen set of controls over a scientifically-honest model
and lets them watch cause-and-effect play out, rather than assembling a scene
from scratch. The shell, tier system, palette, and persistent-scene dolly are as
designed.

### 14.1 Shell & hub

- **Hub** (`src/shell/HubPage.tsx`): a "Strata" wordmark hero set in **Gajraj
  One**, the Earth framed low and zoomed (we see the top of the globe on the
  horizon), and the three module cards laid out **horizontally across the bottom
  half** on desktop (stacked on mobile).
- **Top nav** (`src/ui/TopNav.tsx`): one bar with the logo, the three module
  pills, and a settings popover that holds the **tier toggle**
  (`src/ui/TierToggle.tsx`). The active-module highlight is derived from
  `usePathname()`, not store state — so it is SSR-consistent and survives a hard
  refresh (the store value renders as `hub` on the server and used to drop the
  highlight on reload).
- **Module frame** (`src/shell/ModuleFrame.tsx`): a left sidebar on desktop
  (`w-80`) / a floating bottom card on mobile, with a per-module accent strip.
  The header row `flex-wrap`s so a wide `headerAction` (the Atmosphere layer
  chips) drops below the title instead of overflowing the narrow card.
- **AI tutor** (`src/ui/TutorPanel.tsx`) is present as a collapsible panel.
- **Not built in v1:** share-link / `/s/[hash]`, and undo/redo — the viewer
  modules have no free-form authored state worth serializing, so these were
  dropped from scope rather than stubbed.

### 14.2 Tectonics — era viewer + per-era paleo-coastline rendering

The shipped Tectonics module is a **geologic-time era viewer**: the user scrubs a
timeline across six eras and watches the continents and plates transform. This
replaces the original §2 "drag plates to form convergent/divergent/transform
boundaries" sandbox.

**Eras** (`src/tectonics/eras.ts`): Pangaea (250 Ma), Late Jurassic (150 Ma),
Late Cretaceous (90 Ma), Eocene (50 Ma), Present (0), and a **Future projection
(+50 My, stored as `mya: -50`)** — six in total.

**Why this was hard / what makes it real.** The earlier viewer reused the *same*
modern continent outline in every era and merely repositioned it, so the
continents never actually changed shape. v1 fixes that with **true
paleoshorelines per era**, baked offline:

- **Data:** Scotese & Wright (2018) PALEOMAP PaleoDEMs (Zenodo
  `10.5281/zenodo.5460860`, **CC-BY 4.0**), 1°×1° elevation NetCDF grids, one per
  age. The future era uses **Müller et al. (2019)** plate rotations via
  `gplately` / `pyGPlates` (**CC-BY**). Attribution is shown in the sidebar
  (`src/tectonics/ui/TectonicsBody.tsx`) — keep it.
- **Offline pipeline** (`scripts/paleo/build_paleo_land.py`, run manually; bakes
  `src/tectonics/paleoLand.generated.json`, consumed as `Era.land`). Steps:
  1. **Threshold** each era's DEM at sea level (≥ 0 m) → a land mask.
  2. **Polygonize by cell-union**, not contouring: union the land grid *cells*
     (run-length strips per latitude row → `shapely.unary_union`). matplotlib's
     `contourf` shattered and silently dropped every landmass touching the grid
     boundary / dateline (it lost all of Eurasia and North America); cell-union
     is topology-robust. Polar/edge cell extents are clamped to valid
     lat/lng so a −90 row can't reach −90.5.
  3. **Smooth:** Douglas–Peucker simplify (0.7°) → **Chaikin corner-cutting (2
     passes)** to round the 1° grid stair-steps into curves → light re-simplify
     (0.25°). Smoothing happens per-polygon on the exterior *before* tiling, so
     the outer coast is curved while internal tile seams stay straight.
  4. **Tile** each landmass into ≤20° pieces (grid intersection). Planar earcut
     over a large polygon, re-projected onto the sphere, sags below the ocean
     (chord sag → dark "flooded" patches); bounding every piece to a small cell
     keeps triangles small so the fill stays on the surface. Adjacent tiles share
     exact edges and color, so the seams are invisible.
  5. **Future era:** project present-day land forward 50 My by moving each tile
     **rigidly** by the plate under its centroid (`PlatePartitioner.partition_point`
     → plate id → stage rotation × 50). Per-plate rigid motion (vs. cookie-cutting
     at plate boundaries) keeps whole continents coherent instead of shattering
     them into choppy fragments. Dateline-wrapping rings are skipped to avoid
     smear.
  - Islands < 2 deg² are dropped to keep the payload light; rings are emitted as
    `[lat, lng]` rounded to 0.01°.

**Runtime rendering** (`src/tectonics/scene/Land.tsx`): each polygon piece is
triangulated on the sphere (`triangulatePolygonOnSphere`) at radius **1.006**
with **3 subdivision levels** and radial outward normals. Land is **opaque at
rest** so it renders in the opaque pass and the transparent cloud shell (larger
radius, `depthWrite: false`, `renderOrder` above land) draws *over* it — the
continents sit *under* the clouds, as on the real Earth. Plate outlines render
just above at radius 1.008 at **25% opacity** (the plate boundaries are still the
older hand-authored 7-plate abstraction and don't perfectly trace the new
coastlines — a known follow-up).

**Transitions are different for land vs. plates** — this is the key subtlety:

- **Continents crossfade** (`src/tectonics/landLayers.ts`): paleoshorelines are
  independent geometry per era with no vertex correspondence, so we fade the
  source era out and the target in (`opacity < 1` flips land to the transparent
  pass for the duration of the tween only).
- **Plates morph** (`src/tectonics/tweenPlates.ts`): plate polygons *do* keep
  matching vertex counts across eras, so each vertex SLERPs along the
  great-circle arc — a true positional morph.

**Controls:** an era **Timeline scrubber** (`src/tectonics/ui/Timeline.tsx`) with
clickable era markers — the whole dot-plus-label hit area is the button, so
clicking an era name jumps straight to it whether or not a playthrough is running
— plus a Play/Stop button that animates through the eras. Sidebar copy is
tier-aware (Beginner / Standard / Advanced).

**Known follow-ups:** plate outlines don't yet match the new coastlines (kept at
25%); land renders one mesh per tile (hundreds per era), which is a perf and
e2e-load cost — merging tiles into one mesh per era is the planned optimization.

### 14.3 Atmosphere — day-cycle viewer + season control

The shipped Atmosphere module is a **24-hour day-cycle + general-circulation
viewer**, not the front-building sandbox of the original §2. The user scrubs the
sun across a day, picks a season, and peels visualization layers.

**Model** (`src/atmos/solar.ts`): heliocentric — the sun is fixed at world +X and
the Earth spins on its **23.44° tilted axis** (`EARTH_TILT_RAD`, the single
source of truth shared between the solar math and the tilted Earth mesh). The
subsolar point sweeps longitude with the hour; the day/night terminator follows
from it.

**Controls:**

- **Day-cycle Timeline scrubber** (`src/atmos/ui/Timeline.tsx`) with Play/Stop —
  advances the sun across 24 hours.
- **Season selector** (`src/atmos/ui/AtmosphereBody.tsx`): **Equinox / June /
  December**. This sets the subsolar latitude to **0° / +23.44° (Tropic of
  Cancer) / −23.44° (Tropic of Capricorn)** — i.e. tilts Earth's axis toward or
  away from the sun — which in turn shifts the bright equatorial cloud band
  (ITCZ), the surface-temperature gradient, and the wind belts toward the summer
  hemisphere. (Both equinoxes look identical from a single-day view, so only one
  is exposed.)
- **Layer chips** (`src/atmos/ui/ChipBar.tsx`), rendered in the ModuleFrame
  `headerAction` beside the title: **Cells** (convection cells / wind belts),
  **Temperature** (surface heatmap), **Clouds** (equatorial cloud band) — each
  toggles its store layer independently.
- **Hover inspect** (`src/atmos/ui/InspectReadout.tsx` +
  `scene/HoverInspector.tsx`): hover any point on the globe to read local
  conditions, tier-aware.
- **Legend** (`src/atmos/ui/Legend.tsx`) for the wind belts / doldrums.

### 14.4 Earth Systems — carbon-cycle sandbox

The closest module to its original §2 intent, extended. A
**mass-conservation carbon engine** (`src/systems/carbonModel.ts`,
`src/systems/step.ts`) moves carbon between **four reservoirs** (atmosphere,
ocean, biosphere, lithosphere); the ocean and biosphere act as sinks with
negative feedback, so carbon never disappears, it relocates.

**Controls** (`src/systems/ui/SystemsBody.tsx`):

- **Two forcing levers** (`LeverSlider.tsx`, a track-and-knob mirroring the
  Atmosphere scrubber grammar): **Fossil-fuel emissions** (0 … `MAX_FOSSIL`
  GtC/yr) and **Land use** (reforesting ↔ neutral ↔ deforesting).
- **Scenario presets** (`SCENARIO_LIST`, three presets) plus a **Reset** button
  mounted in the ModuleFrame header (`SystemsResetButton.tsx`).
- **Year-based playback Timeline** (`SystemsTimeline.tsx`) — draggable *and*
  playable; the projection is deterministic so scrubbing and playing agree.
- **Reservoir gauges** (`ReservoirGauges.tsx`), tier-aware.

**Scene** (`src/systems/scene/`): carbon-flow particles (`CarbonFlows.tsx`) and
reservoir volumes (`Reservoirs.tsx`), plus a **"dying-planet" degradation**
visual — the land browns and clouds turn smoggy as atmospheric carbon rises above
the active scenario's starting point.

### 14.5 Module-control quick reference

| Module | Primary control | Secondary controls | Time axis |
| --- | --- | --- | --- |
| **Tectonics** | Era timeline (6 eras, clickable markers) | — | geologic, Play/Stop through eras |
| **Atmosphere** | Day-cycle scrubber | **Season** (Equinox/June/December); layer chips (Cells/Temperature/Clouds); hover-inspect | 24-hour day, Play/Stop |
| **Earth Systems** | Two levers (fossil-fuel, land use) | Scenario presets + Reset; reservoir gauges | year-based, draggable + Play/Stop |

All three share the tier toggle, the persistent globe scene, and the
bottom-anchored timeline grammar.

---

**End of design document.**