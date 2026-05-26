# Strata

Earth-science 3D playground. Companion to [Molecular](https://github.com/inkorange/molecular).
Spec: [`.claude/DESIGN.md`](.claude/DESIGN.md).

## Dev

```sh
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # vitest
pnpm test:e2e     # playwright (mobile + desktop chrome)
pnpm typecheck
pnpm lint
```

## Asset credits

- `public/textures/earth_daymap.jpg`, `earth_night.jpg`, `earth_clouds.jpg`, `stars.jpg`, `moon.jpg` — supplied by Chris (Solar System Scope or equivalent).
- `public/textures/earth_normal.jpg` — Earth normal map (2048×1024) from the three.js examples repo (`examples/textures/planets/earth_normal_2048.jpg`), originally from Solar System Scope, CC BY 4.0 (https://www.solarsystemscope.com/textures/).
- `public/textures/earth_roughness.jpg` — derived from the daymap luminance via `scripts/compress-textures.ts`.
- `public/textures/env_space_2k.hdr` — Poly Haven `satara_night_no_lamps` 2K, CC0 (https://polyhaven.com/a/satara_night_no_lamps).
- Continent polygon data: derived from [Natural Earth](https://www.naturalearthdata.com/) 110m country boundaries (public domain). Aggregated by continent attribute and simplified to ~96 vertices per continent for Present; other eras are centroid-morphed approximations.
