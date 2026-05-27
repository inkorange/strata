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
- Continent polygon data: derived from [Natural Earth](https://www.naturalearthdata.com/) 50m country boundaries (public domain). Aggregated by continent attribute into MultiPolygon pieces (mainland + islands); up to 300–400 vertices for major landmasses, 30–120 for islands (~2200 total vertices per era). Each continent carries multiple disjoint pieces — e.g. North America (6 pieces: mainland, Greenland, Cuba, Hispaniola, Newfoundland, Vancouver Island), Eurasia (12 pieces), Africa (3 pieces: mainland, Madagascar, Socotra), Australia (5 pieces: mainland, NZ North/South Islands, PNG, Tasmania). Other eras are centroid-morphed approximations of the Present shapes.
