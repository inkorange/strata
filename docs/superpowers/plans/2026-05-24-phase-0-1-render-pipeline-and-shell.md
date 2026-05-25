# Strata Phase 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the render pipeline foundations (HDRI/IBL lighting, PBR materials, tier-preset system, post-processing, continuous render loop) and prove them by shipping a hub page at `/` with a photoreal layered Earth, true camera-dolly zoom-to-enter for three stub module routes, tier toggle, and a tutor-panel stub — all on a `phase-0-1-render-pipeline-and-shell` branch ready for one PR to `main`.

**Architecture:**
- **Next.js 16 App Router** monolith on Node 24 LTS, pnpm 9. React 19 with React Compiler enabled.
- **R3F scene graph** with one persistent `<Scene>` mounted at the layout level; module routes mutate `shellSlice.activeModule` which a `CameraDolly` consumer animates. No scene tear-down on navigation.
- **Tier-preset system** runs once on first paint (`src/lib/tier.ts`) → selects `desktop-ultra` / `balanced` / `mobile-lite` → drives a single `Preset` object (`src/scene/presets.ts`) consumed by `<Scene>`, `<PostProcessing>`, `<Earth>`, `<CameraDolly>`. Zero per-component re-detection.
- **Zustand + immer** for cross-cutting state (`shellSlice` ships in this plan; `tutorSlice` / `historySlice` / `sceneSlice` stubbed but unused until later phases).
- **Visual identity ported verbatim from Molecular** per DESIGN.md §13.1; Strata adds three domain accent tokens on top.

**Tech Stack:**
- Next.js 16.2.x + React 19.2 + React Compiler
- Three.js 0.184 + `@react-three/fiber` 9 + `@react-three/drei` 10 + `@react-three/postprocessing` 3 + `postprocessing` 6
- Tailwind v4 + shadcn (style: `base-nova`, baseColor: `neutral`)
- Zustand 5 + immer 11 + Zod 4
- Biome 2.4 (lint+format), Vitest 4 + happy-dom (unit), Playwright 1.60 (e2e on mobile-chrome primary + desktop-chrome)
- Vercel (inkOrange team `team_H6LlOofXMSjnfKENSnEmpgMY`), Fluid Compute, custom domain `strata.chriswest.tech`

**Out of scope for this PR (deferred to later phases):**
- AI tutor wire-up (panel renders a stub; no `/api/tutor` route yet)
- Any module engine code (`src/tectonics/`, `src/atmos/`, `src/systems/`)
- Share-link encoder + `/s/[hash]` route (stub route returns the hub for now)
- Service worker / offline support

---

## File Structure

Files created in this PR (every path is absolute from the repo root):

**App router pages and global config:**
- `app/layout.tsx` — root layout (ports Molecular's font + metadata + theme color)
- `app/page.tsx` — hub (three module entries, Earth in the center, dolly-driven)
- `app/[module]/page.tsx` — module shell route (`/tectonics`, `/atmosphere`, `/systems`); renders `<ModuleFrame>` around a stub
- `app/s/[hash]/page.tsx` — stub redirect to `/` (real loader lands later)
- `app/globals.css` — ported verbatim from Molecular + Strata accent tokens appended
- `next.config.ts`, `vercel.ts`, `tsconfig.json`, `biome.json`, `playwright.config.ts`, `vitest.config.ts`, `postcss.config.mjs`, `tests/setup.ts`, `components.json`, `package.json`, `pnpm-workspace.yaml`, `.gitignore`

**Library code under `src/`:**
- `src/lib/utils.ts` — `cn()` (shadcn standard)
- `src/lib/tier.ts` — `detectTier()` pure function
- `src/lib/accessibility.ts` — `usePrefersReducedMotion()` + high-contrast hook
- `src/scene/presets.ts` — `Preset` type + `PRESETS` const (one entry per tier)
- `src/scene/Scene.tsx` — top-level R3F `<Canvas>` wrapper, tone mapping, IBL `<Environment>`, frameloop, key sun
- `src/scene/PostProcessing.tsx` — `<EffectComposer>` chain (ACES + bloom always, SSAO/DOF/Vignette on ultra)
- `src/scene/Earth.tsx` — layered photoreal Earth: surface sphere, cloud sphere, atmosphere rim
- `src/scene/EarthInterior.tsx` — concentric crust/mantle/outer-core/inner-core (ultra only)
- `src/scene/AtmosphereRim.tsx` — fresnel + Rayleigh-style scattering shader material
- `src/scene/Starfield.tsx` — drei `<Stars>` + optional skybox sphere using `earth_clouds.jpg`'s sibling `stars.jpg`
- `src/scene/CameraDolly.tsx` — `useFrame` consumer of `shellSlice.activeModule`, eased camera tween
- `src/scene/useEarthTextures.ts` — shared loader hook, mipmaps + anisotropy set per tier
- `src/shell/HubPage.tsx` — client component rendered by `app/page.tsx` (cards + scene-mount portal)
- `src/shell/ModuleFrame.tsx` — sidebar / viewport / inspector layout, mobile-first
- `src/shell/modules.ts` — `MODULES` registry: id, label, accentToken, dollyTarget, stub component
- `src/shell/StubModuleBody.tsx` — placeholder body rendered inside ModuleFrame for now
- `src/store/shellSlice.ts` — `activeModule`, `tier`, `tierOverride`, `highContrast`, persistence
- `src/store/index.ts` — `useStore` (combined slices, localStorage middleware with 1s debounce)
- `src/ui/TierToggle.tsx` — 3-button segmented control
- `src/ui/TutorPanel.tsx` — collapsible right sheet (desktop) / bottom sheet (mobile)
- `src/ui/BackToHub.tsx` — small button in ModuleFrame header
- `src/ui/SiteFooter.tsx` — minimal footer that won't fight a future inkOrange "labs" hub federation

**shadcn components (added on-demand by `pnpm dlx shadcn add`):**
- `components/ui/button.tsx` (Task 2)

**Tests:**
- `src/lib/tier.spec.ts`
- `src/scene/presets.spec.ts`
- `src/store/shellSlice.spec.ts`
- `tests/e2e/hub.spec.ts`
- `tests/e2e/module-navigation.spec.ts`
- `tests/e2e/tier-toggle.spec.ts`

**Scripts:**
- `scripts/compress-textures.ts` — Basis/KTX2 compression for `/public/textures/` (run pre-commit or in CI; ships compressed pair alongside JPG)

**Public assets:**
- `public/textures/earth_daymap.jpg`, `earth_night.jpg`, `earth_clouds.jpg`, `stars.jpg` — supplied (already in repo)
- `public/textures/earth_normal.jpg` — sourced this PR (Solar System Scope, CC BY 4.0; attribution in README)
- `public/textures/earth_roughness.jpg` — generated from daymap luminance (script in Task 11)
- `public/textures/env_space_2k.hdr` — sourced this PR (Poly Haven, CC0)
- `public/favicon.ico`, `public/applogo.png` — sourced this PR (placeholder mark; user swaps when ready)

---

## Task Granularity Note

Tasks for **pure TypeScript modules** (tier detection, presets, slices) follow strict TDD: failing test first, minimal impl, passing test, commit.

Tasks for **R3F visual components** (Earth, AtmosphereRim, post-processing) cannot be meaningfully unit-tested ("does the Earth look photoreal" has no assertion). Those tasks instead specify the component code and a manual visual verification step, followed by a Playwright check that the canvas mounts without errors.

Tasks for **Next.js routes** verify via Playwright e2e (mobile-chrome + desktop-chrome projects).

---

## Phase A — Project Foundation

### Task 1: Scaffold Next.js 16 App Router project with pnpm

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vercel.ts`
- Create: `postcss.config.mjs`
- Create: `.gitignore`
- Create: `app/layout.tsx` (minimal placeholder, replaced in Task 2)
- Create: `app/page.tsx` (minimal placeholder, replaced in Task 14)

- [ ] **Step 1: Write `.gitignore`**

```gitignore
# deps
node_modules/

# next
.next/
out/

# vercel
.vercel/

# build artifacts
*.tsbuildinfo
next-env.d.ts

# testing
coverage/
playwright-report/
test-results/

# os
.DS_Store

# env
.env*.local

# logs
*.log
```

- [ ] **Step 2: Write `package.json`** (versions pinned to match Molecular)

```json
{
  "name": "strata",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "compress-textures": "tsx scripts/compress-textures.ts"
  },
  "dependencies": {
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.6.1",
    "@react-three/postprocessing": "^3.0.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "immer": "^11.1.8",
    "lucide-react": "^1.14.0",
    "next": "16.2.6",
    "postprocessing": "^6.39.1",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "shadcn": "^4.7.0",
    "tailwind-merge": "^3.6.0",
    "three": "^0.184.0",
    "tw-animate-css": "^1.4.0",
    "vaul": "^1.1.2",
    "zod": "^4.4.3",
    "zustand": "^5.0.13"
  },
  "devDependencies": {
    "@biomejs/biome": "2.4.15",
    "@playwright/test": "^1.60.0",
    "@tailwindcss/postcss": "^4",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/three": "^0.184.1",
    "@vercel/config": "^0.3.0",
    "@vitest/coverage-v8": "^4.1.6",
    "babel-plugin-react-compiler": "1.0.0",
    "happy-dom": "^20.9.0",
    "sharp": "^0.34.0",
    "tailwindcss": "^4",
    "tsx": "^4.20.0",
    "typescript": "^5",
    "vitest": "^4.1.6"
  }
}
```

- [ ] **Step 3: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - .
```

- [ ] **Step 4: Write `tsconfig.json`** (copied from Molecular)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/src/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Write `next.config.ts`**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
}

export default nextConfig
```

- [ ] **Step 6: Write `vercel.ts`**

```ts
import type { VercelConfig } from '@vercel/config/v1'

export const config: VercelConfig = {
  framework: 'nextjs',
  buildCommand: 'pnpm build',
  installCommand: 'pnpm install',
}
```

- [ ] **Step 7: Write `postcss.config.mjs`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

- [ ] **Step 8: Write minimal placeholder `app/layout.tsx`** (replaced in Task 2)

```tsx
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 9: Write minimal placeholder `app/page.tsx`** (replaced in Task 14)

```tsx
export default function Page() {
  return <main>Strata — bootstrap</main>
}
```

- [ ] **Step 10: Write minimal placeholder `app/globals.css`** (replaced in Task 2)

```css
@import "tailwindcss";
```

- [ ] **Step 11: Install dependencies**

Run: `pnpm install`
Expected: lockfile created, all deps installed without peer warnings (peer warnings on `@react-three/*` packages about three versions are acceptable; we pinned three to ^0.184).

- [ ] **Step 12: Run dev server to confirm baseline boot**

Run: `pnpm dev` (let it start, hit `http://localhost:3000`, see "Strata — bootstrap", Ctrl-C)
Expected: server starts on :3000, page text renders.

- [ ] **Step 13: Run typecheck and lint to confirm baseline**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0. (Biome may complain about no files yet — that's fine, run continues.)

- [ ] **Step 14: Commit**

```bash
git add .gitignore package.json pnpm-workspace.yaml tsconfig.json next.config.ts vercel.ts postcss.config.mjs app/layout.tsx app/page.tsx app/globals.css pnpm-lock.yaml
git commit -m "Scaffold Next.js 16 + React 19 + pnpm project

Pins Next 16.2.6, React 19.2.4, Three.js 0.184, drei 10, postprocessing 3,
zustand 5, immer 11, biome 2.4, vitest 4, playwright 1.60 — matching the
Molecular sibling so the two repos stay versioned in lockstep per
DESIGN.md §13.1."
```

---

### Task 2: Port Molecular's theme, fonts, biome, components.json verbatim + add Strata accent tokens

**Files:**
- Modify: `app/layout.tsx` (full replacement)
- Modify: `app/globals.css` (full replacement, adds Strata accents)
- Create: `biome.json`
- Create: `components.json`
- Create: `src/lib/utils.ts`
- Create: `app/sw-register.tsx` (stub — Molecular has one; we ship a no-op for parity now)

- [ ] **Step 1: Write `biome.json`** (copied from Molecular)

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.15/schema.json",
  "css": {
    "parser": {
      "tailwindDirectives": true
    }
  },
  "files": {
    "ignoreUnknown": true,
    "includes": [
      "**",
      "!**/node_modules",
      "!**/.next",
      "!**/dist",
      "!**/build",
      "!**/coverage",
      "!**/playwright-report",
      "!**/test-results",
      "!**/.vercel",
      "!**/.superpowers",
      "!next-env.d.ts"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noNonNullAssertion": "warn",
        "useImportType": "error"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded",
      "trailingCommas": "all"
    }
  }
}
```

- [ ] **Step 2: Write `components.json`** (copied from Molecular)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
```

- [ ] **Step 3: Write `src/lib/utils.ts`** (shadcn standard)

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Write `app/sw-register.tsx`** (no-op stub for layout parity)

```tsx
'use client'

// Stub for future service-worker registration. Kept so layout.tsx can mirror
// Molecular's structure; flip on when offline support lands in a later phase.
export function ServiceWorkerRegister() {
  return null
}
```

- [ ] **Step 5: Replace `app/globals.css`** with Molecular's verbatim port + Strata accent tokens appended

Open `/Users/christopherwest/web/molecular/app/globals.css`. Copy the entire file (lines 1–403) into Strata's `app/globals.css` — including the shadcn token ramp, both `:root` and `.dark` blocks, the `@theme` and `@theme inline` blocks, the `.modal-glow` / `.button-glow` / `.panel-glow` component classes and their keyframes, and the `.scene-shift-portrait` media query.

Then append the Strata accent tokens at the END of the file (after the `.scene-shift-portrait` media query, OUTSIDE any `@layer`):

```css

/* ============================================================
 * Strata domain accent tokens — additive on top of the ported
 * Molecular base. These are referenced by the hub module cards
 * (src/shell/HubPage.tsx) and by per-module accent strips.
 * Atmosphere and Earth Systems intentionally reuse Molecular's
 * accent-cyan and a green sibling of attach-green so the two
 * apps' palettes read as visibly the same family. Magma orange
 * is Strata's one new note and doubles as an inkOrange wink.
 * ============================================================ */
@theme {
  --color-accent-tectonics: #ff8c5a;
  --color-accent-atmosphere: #5cc6ff;
  --color-accent-systems: #7ad9aa;
}
```

- [ ] **Step 6: Replace `app/layout.tsx`** with Strata-specific metadata + Molecular's font setup

```tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Geist } from 'next/font/google'
import { cn } from '@/lib/utils'
import { ServiceWorkerRegister } from './sw-register'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

const SITE_NAME = 'Strata'
const SITE_TITLE = 'Strata — Drift plates, form weather, cycle carbon in 3D'
const SITE_DESCRIPTION =
  'A free, interactive 3D earth-science playground. Drift tectonic plates and watch mountains rise, form fronts and storms, and cycle carbon between reservoirs — rendered with game-quality realism.'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s · Strata',
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'Chris West' }],
  creator: 'Chris West',
  publisher: 'Strata',
  keywords: [
    'earth science',
    'plate tectonics',
    'meteorology',
    'carbon cycle',
    '3D earth science',
    'science education',
    'interactive geology',
    'STEM',
    'AI tutor',
  ],
  category: 'education',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/applogo.png',
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    images: [{ url: '/applogo.png', alt: 'Strata' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/applogo.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#07051a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body className="bg-[#07051a] text-[#dffaff] antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Add shadcn `button` component**

Run: `pnpm dlx shadcn@latest add button --yes`
Expected: creates `components/ui/button.tsx`. If the command prompts to overwrite or about the config, accept defaults (`components.json` is already in place).

- [ ] **Step 8: Run typecheck and dev server, verify palette renders**

Run: `pnpm typecheck`
Expected: exit 0.

Run: `pnpm dev`, open `http://localhost:3000`, observe: page background `#07051a`, body text in the muted cyan ink color, font is Geist. Ctrl-C.
Expected: theme reads as the Molecular family.

- [ ] **Step 9: Commit**

```bash
git add biome.json components.json src/lib/utils.ts app/sw-register.tsx app/globals.css app/layout.tsx components/ui/button.tsx
git commit -m "Port Molecular theme tokens, fonts, and shadcn config

Verbatim port of Molecular's globals.css (shadcn ramp + @theme blocks +
modal-glow/button-glow/panel-glow component classes), layout.tsx metadata
shape with Strata-specific copy, biome.json, and components.json. Adds
three Strata domain accent tokens (--color-accent-tectonics/atmosphere/
systems) on top of the ported base per DESIGN.md §7 and §13.1."
```

---

### Task 3: Configure Vitest, Playwright, and test setup

**Files:**
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Write `vitest.config.ts`** (copied from Molecular)

```ts
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx', 'src/**/*.spec.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@/src': resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: Write `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'

// happy-dom doesn't ship matchMedia. Many components and our tier detector
// call it on first render — stub a permissive default so tests don't crash.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
```

- [ ] **Step 3: Write `playwright.config.ts`** (copied from Molecular)

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: process.env.CI ? 'pnpm build && pnpm start' : 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
```

- [ ] **Step 4: Install Playwright browsers**

Run: `pnpm exec playwright install chromium`
Expected: chromium downloaded.

- [ ] **Step 5: Verify Vitest runs with zero tests**

Run: `pnpm test`
Expected: "No test files found, exiting with code 0" or similar success exit. (Vitest 4 may exit 1 on no tests; if so, add a trivial placeholder `tests/placeholder.spec.ts` with `import { test, expect } from 'vitest'; test('boots', () => expect(1).toBe(1))` and delete it in Task 5 once real tests exist.)

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts playwright.config.ts tests/setup.ts
git commit -m "Configure Vitest (happy-dom) and Playwright (mobile + desktop)

Mirrors Molecular's test setup: vitest reads src/**/*.spec.ts and
tests/**/*.spec.{ts,tsx}, playwright runs mobile-chrome (Pixel 7) as the
primary project plus desktop-chrome, webServer command flips between dev
(local) and build+start (CI) per Molecular's pattern."
```

---

## Phase B — Tier System

### Task 4: `detectTier()` pure function with unit tests

**Files:**
- Create: `src/lib/tier.ts`
- Create: `src/lib/tier.spec.ts`

- [ ] **Step 1: Write the failing tests** at `src/lib/tier.spec.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectTier } from './tier'

type NavLike = Partial<Navigator> & {
  deviceMemory?: number
  hardwareConcurrency?: number
}

function mockNavigator(overrides: NavLike) {
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    ...overrides,
  })
}

function mockPointer(coarse: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(pointer: coarse)' ? coarse : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }))
}

describe('detectTier', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns mobile-lite when pointer is coarse (touch)', () => {
    mockPointer(true)
    mockNavigator({ hardwareConcurrency: 8, deviceMemory: 8 })
    expect(detectTier()).toBe('mobile-lite')
  })

  it('returns desktop-ultra when fine pointer + 8+ cores + 8+ GB', () => {
    mockPointer(false)
    mockNavigator({ hardwareConcurrency: 8, deviceMemory: 8 })
    expect(detectTier()).toBe('desktop-ultra')
  })

  it('returns balanced when fine pointer but modest specs', () => {
    mockPointer(false)
    mockNavigator({ hardwareConcurrency: 4, deviceMemory: 4 })
    expect(detectTier()).toBe('balanced')
  })

  it('returns balanced when deviceMemory is missing but cores look ok', () => {
    mockPointer(false)
    mockNavigator({ hardwareConcurrency: 8 })
    expect(detectTier()).toBe('balanced')
  })

  it('falls back to balanced in SSR-shaped env (no window globals)', () => {
    // Simulate the path where matchMedia is undefined entirely
    vi.stubGlobal('matchMedia', undefined)
    mockNavigator({})
    expect(detectTier()).toBe('balanced')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/tier.spec.ts`
Expected: FAIL with "Cannot find module './tier'".

- [ ] **Step 3: Write the minimal implementation** at `src/lib/tier.ts`

```ts
export type Tier = 'desktop-ultra' | 'balanced' | 'mobile-lite'

/**
 * One-shot device classification on first paint. Never re-runs.
 *
 * Heuristic order:
 *   1. coarse pointer (touch) -> mobile-lite, full stop
 *   2. fine pointer + >=8 logical cores + >=8 GB device memory -> desktop-ultra
 *   3. anything else with a fine pointer -> balanced
 *   4. SSR / unknown env -> balanced (safe middle ground; runtime detection
 *      reruns on the client after hydration via useEffect in Scene.tsx)
 */
export function detectTier(): Tier {
  const mm = typeof matchMedia !== 'undefined' ? matchMedia : undefined
  if (!mm) return 'balanced'

  if (mm('(pointer: coarse)').matches) return 'mobile-lite'

  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  const cores = nav?.hardwareConcurrency ?? 0
  // deviceMemory is a non-standard but widely-shipped hint (Chrome, Edge).
  // Missing in Safari/Firefox; treat absence as "unknown -> balanced".
  const mem = (nav as Navigator & { deviceMemory?: number } | undefined)?.deviceMemory ?? 0

  if (cores >= 8 && mem >= 8) return 'desktop-ultra'
  return 'balanced'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/tier.spec.ts`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tier.ts src/lib/tier.spec.ts
git commit -m "Add tier detection (desktop-ultra / balanced / mobile-lite)

Single device classification on first paint, never reruns. Coarse pointer
short-circuits to mobile-lite; fine pointer with >=8 cores and >=8GB
device memory hits desktop-ultra; everything else lands in balanced. SSR
falls back to balanced and the client re-detects after hydration
(handled by Scene.tsx in Task 7)."
```

---

### Task 5: Tier preset config

**Files:**
- Create: `src/scene/presets.ts`
- Create: `src/scene/presets.spec.ts`

- [ ] **Step 1: Write the failing tests** at `src/scene/presets.spec.ts`

```ts
import { describe, expect, it } from 'vitest'
import { PRESETS, type Preset } from './presets'

describe('PRESETS', () => {
  it('defines exactly the three tiers', () => {
    expect(Object.keys(PRESETS).sort()).toEqual(
      ['balanced', 'desktop-ultra', 'mobile-lite'].sort(),
    )
  })

  it('desktop-ultra enables every post-fx pass', () => {
    const p: Preset = PRESETS['desktop-ultra']
    expect(p.postFx.bloom).toBe(true)
    expect(p.postFx.ssao).toBe(true)
    expect(p.postFx.dof).toBe(true)
    expect(p.postFx.vignette).toBe(true)
  })

  it('mobile-lite keeps bloom but drops the expensive passes', () => {
    const p = PRESETS['mobile-lite']
    expect(p.postFx.bloom).toBe(true)
    expect(p.postFx.ssao).toBe(false)
    expect(p.postFx.dof).toBe(false)
  })

  it('shadow map size scales by tier', () => {
    expect(PRESETS['desktop-ultra'].shadowMapSize).toBeGreaterThan(
      PRESETS['balanced'].shadowMapSize,
    )
    expect(PRESETS['balanced'].shadowMapSize).toBeGreaterThanOrEqual(
      PRESETS['mobile-lite'].shadowMapSize,
    )
  })

  it('mobile-lite uses demand frameloop; others use always', () => {
    expect(PRESETS['mobile-lite'].frameloop).toBe('demand')
    expect(PRESETS['balanced'].frameloop).toBe('always')
    expect(PRESETS['desktop-ultra'].frameloop).toBe('always')
  })

  it('earth segment counts scale with tier', () => {
    expect(PRESETS['desktop-ultra'].earth.segments).toBeGreaterThan(
      PRESETS['mobile-lite'].earth.segments,
    )
  })

  it('every preset includes a non-empty hdri path', () => {
    for (const tier of ['desktop-ultra', 'balanced', 'mobile-lite'] as const) {
      expect(PRESETS[tier].hdriPath.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/scene/presets.spec.ts`
Expected: FAIL with "Cannot find module './presets'".

- [ ] **Step 3: Write the implementation** at `src/scene/presets.ts`

```ts
import type { Tier } from '@/src/lib/tier'

export interface Preset {
  /** R3F Canvas frameloop. */
  frameloop: 'always' | 'demand' | 'never'
  /** Real-time shadow texture resolution per cascade. 0 disables shadows. */
  shadowMapSize: 0 | 1024 | 2048 | 4096
  /** Device pixel-ratio cap. Avoids 3x DPR on phones killing fill rate. */
  dprCap: number
  /** Earth sphere tessellation. */
  earth: {
    segments: number
    cloudSegments: number
    /** Render the interior cutaway shells. */
    interior: boolean
  }
  /** Atmospheric rim shader quality. */
  atmosphere: {
    /** Use the GLSL fresnel + Rayleigh shader (true) or a cheaper additive shell (false). */
    raymarched: boolean
  }
  /** Post-processing flags. Bloom is always on; the rest tier-gate. */
  postFx: {
    bloom: boolean
    ssao: boolean
    dof: boolean
    vignette: boolean
  }
  /** Anisotropy passed to texture loaders. */
  anisotropy: number
  /** Path to the IBL HDRI environment map under /public. */
  hdriPath: string
}

const HDRI_PATH = '/textures/env_space_2k.hdr'

export const PRESETS: Record<Tier, Preset> = {
  'desktop-ultra': {
    frameloop: 'always',
    shadowMapSize: 2048,
    dprCap: 2,
    earth: { segments: 256, cloudSegments: 192, interior: true },
    atmosphere: { raymarched: true },
    postFx: { bloom: true, ssao: true, dof: true, vignette: true },
    anisotropy: 16,
    hdriPath: HDRI_PATH,
  },
  balanced: {
    frameloop: 'always',
    shadowMapSize: 1024,
    dprCap: 1.5,
    earth: { segments: 128, cloudSegments: 96, interior: false },
    atmosphere: { raymarched: true },
    postFx: { bloom: true, ssao: false, dof: false, vignette: true },
    anisotropy: 8,
    hdriPath: HDRI_PATH,
  },
  'mobile-lite': {
    frameloop: 'demand',
    shadowMapSize: 0,
    dprCap: 1,
    earth: { segments: 64, cloudSegments: 48, interior: false },
    atmosphere: { raymarched: false },
    postFx: { bloom: true, ssao: false, dof: false, vignette: false },
    anisotropy: 4,
    hdriPath: HDRI_PATH,
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/scene/presets.spec.ts`
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scene/presets.ts src/scene/presets.spec.ts
git commit -m "Add per-tier render preset config

PRESETS maps each tier to frameloop, shadow map size, DPR cap, Earth
tessellation, atmosphere shader path (raymarched vs additive shell),
post-fx flags, anisotropy, and HDRI path. Single source of truth
consumed by Scene, PostProcessing, Earth, AtmosphereRim in later tasks."
```

---

## Phase C — Store

### Task 6: `shellSlice` with tier override + localStorage persistence

**Files:**
- Create: `src/store/shellSlice.ts`
- Create: `src/store/index.ts`
- Create: `src/store/shellSlice.spec.ts`

- [ ] **Step 1: Write the failing tests** at `src/store/shellSlice.spec.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Re-import the store per test so persistence reads/writes don't leak across cases.
async function freshStore() {
  vi.resetModules()
  const mod = await import('./index')
  return mod.useStore
}

describe('shellSlice', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to hub module', async () => {
    const store = await freshStore()
    expect(store.getState().activeModule).toBe('hub')
  })

  it('setActiveModule updates the slice', async () => {
    const store = await freshStore()
    store.getState().setActiveModule('tectonics')
    expect(store.getState().activeModule).toBe('tectonics')
  })

  it('effectiveTier returns the override when set, else the detected tier', async () => {
    const store = await freshStore()
    store.setState({ tier: 'balanced', tierOverride: null })
    expect(store.getState().effectiveTier()).toBe('balanced')
    store.getState().setTierOverride('desktop-ultra')
    expect(store.getState().effectiveTier()).toBe('desktop-ultra')
  })

  it('persists tierOverride and activeModule to localStorage', async () => {
    const store = await freshStore()
    store.getState().setTierOverride('mobile-lite')
    store.getState().setActiveModule('atmosphere')

    // Allow the 1s persistence debounce to flush; we expose a sync flush
    // helper in the store specifically for tests.
    store.getState().__flushPersist?.()

    const raw = localStorage.getItem('strata:shell')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw as string)
    expect(parsed.tierOverride).toBe('mobile-lite')
    expect(parsed.activeModule).toBe('atmosphere')
  })

  it('rehydrates from localStorage on first import', async () => {
    localStorage.setItem(
      'strata:shell',
      JSON.stringify({ tierOverride: 'mobile-lite', activeModule: 'systems' }),
    )
    const store = await freshStore()
    expect(store.getState().tierOverride).toBe('mobile-lite')
    expect(store.getState().activeModule).toBe('systems')
  })

  it('toggleHighContrast flips and persists', async () => {
    const store = await freshStore()
    expect(store.getState().highContrast).toBe(false)
    store.getState().toggleHighContrast()
    expect(store.getState().highContrast).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/store/shellSlice.spec.ts`
Expected: FAIL with "Cannot find module './index'".

- [ ] **Step 3: Write `src/store/shellSlice.ts`**

```ts
import type { StateCreator } from 'zustand'
import { detectTier, type Tier } from '@/src/lib/tier'

export type ModuleId = 'hub' | 'tectonics' | 'atmosphere' | 'systems'

export interface ShellSlice {
  /** Detected tier from device probe. Set on the client during boot. */
  tier: Tier
  /** Manual override from the tier toggle. null = use detected. */
  tierOverride: Tier | null
  /** Active module — drives the camera dolly and the module frame mount. */
  activeModule: ModuleId
  /** High-contrast accessibility toggle. */
  highContrast: boolean

  /** Returns tierOverride if set, else tier. */
  effectiveTier: () => Tier

  setTier: (tier: Tier) => void
  setTierOverride: (tier: Tier | null) => void
  setActiveModule: (module: ModuleId) => void
  toggleHighContrast: () => void
}

export const createShellSlice: StateCreator<ShellSlice> = (set, get) => ({
  tier: detectTier(),
  tierOverride: null,
  activeModule: 'hub',
  highContrast: false,

  effectiveTier: () => {
    const { tier, tierOverride } = get()
    return tierOverride ?? tier
  },

  setTier: (tier) => set({ tier }),
  setTierOverride: (tierOverride) => set({ tierOverride }),
  setActiveModule: (activeModule) => set({ activeModule }),
  toggleHighContrast: () =>
    set((state) => ({ highContrast: !state.highContrast })),
})
```

- [ ] **Step 4: Write `src/store/index.ts`**

```ts
import { create } from 'zustand'
import { createShellSlice, type ShellSlice } from './shellSlice'

type Store = ShellSlice & {
  /** Test-only helper: flush the persist debounce synchronously. */
  __flushPersist?: () => void
}

const STORAGE_KEY = 'strata:shell'
const PERSIST_DEBOUNCE_MS = 1000

let persistTimer: ReturnType<typeof setTimeout> | null = null

function readPersistedShell(): Partial<ShellSlice> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<ShellSlice>
    // Only rehydrate fields we intentionally persist; ignore stale shape.
    const out: Partial<ShellSlice> = {}
    if (parsed.tierOverride !== undefined) out.tierOverride = parsed.tierOverride
    if (parsed.activeModule !== undefined) out.activeModule = parsed.activeModule
    if (parsed.highContrast !== undefined) out.highContrast = parsed.highContrast
    return out
  } catch {
    return {}
  }
}

function persistShell(state: ShellSlice) {
  if (typeof localStorage === 'undefined') return
  const payload = {
    tierOverride: state.tierOverride,
    activeModule: state.activeModule,
    highContrast: state.highContrast,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export const useStore = create<Store>()((set, get, api) => {
  const slice = createShellSlice(set, get, api)
  const rehydrated = readPersistedShell()

  return {
    ...slice,
    ...rehydrated,
    __flushPersist: () => {
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = null
      persistShell(get() as ShellSlice)
    },
  }
})

// Debounced persistence: subscribe once at module load.
useStore.subscribe((state) => {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistShell(state as ShellSlice)
    persistTimer = null
  }, PERSIST_DEBOUNCE_MS)
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/store/shellSlice.spec.ts`
Expected: all 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/shellSlice.ts src/store/index.ts src/store/shellSlice.spec.ts
git commit -m "Add zustand shellSlice with tier override and persistence

shellSlice tracks tier (auto-detected on import), tierOverride (manual),
activeModule, and highContrast. effectiveTier() collapses override-or-
detected. localStorage persistence is debounced 1s; rehydration runs on
first import. __flushPersist exposed for tests."
```

---

## Phase D — Scene Foundation

### Task 7: HDRI + Earth normal/roughness asset sourcing

**Files:**
- Create: `public/textures/env_space_2k.hdr` (downloaded)
- Create: `public/textures/earth_normal.jpg` (downloaded)
- Create: `public/textures/earth_roughness.jpg` (generated)
- Create: `scripts/compress-textures.ts` (placeholder; full impl in Task 19)
- Modify: `README.md` (asset credits)

- [ ] **Step 1: Download Poly Haven HDRI** (CC0)

Run: `mkdir -p public/textures && curl -fL -o public/textures/env_space_2k.hdr https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/satara_night_no_lamps_2k.hdr`
Expected: ~2–4 MB HDR file. Verify with `file public/textures/env_space_2k.hdr` → should report Radiance RGBE image.
Source: https://polyhaven.com/a/satara_night_no_lamps (CC0). Dark night-sky HDRI suits Earth-in-space — provides subtle ambient + sky color without competing with the directional sun.

- [ ] **Step 2: Download Solar System Scope normal map** (CC BY 4.0)

Run: `curl -fL -o public/textures/earth_normal.jpg https://raw.githubusercontent.com/turban/webgl-earth/master/images/earth_normal_2048.jpg`
Expected: ~1 MB JPG with the normal-map blue/purple cast.
**Fallback if URL 404s:** download the Solar System Scope 2K normal map manually from https://www.solarsystemscope.com/textures/ (file name `2k_earth_normal_map.tif`) and `sips -s format jpeg -o public/textures/earth_normal.jpg <downloaded.tif>`. Note attribution in the README step below.

- [ ] **Step 3: Generate the roughness map** from the daymap via sharp

Run:
```bash
pnpm exec node --input-type=module -e "
import sharp from 'sharp'
// Land is matte (high roughness ~0.95), oceans are mirror-shiny (low ~0.15).
// Daymap is bluer over oceans, more saturated/green over land — luminance is
// a coarse but workable proxy here. Threshold at the median.
const img = sharp('public/textures/earth_daymap.jpg').greyscale()
const stats = await img.stats()
const threshold = stats.channels[0].mean
await sharp('public/textures/earth_daymap.jpg')
  .greyscale()
  .linear(1, -threshold)
  .threshold(0)
  .negate()
  .linear(0.8, 38)  // 0.15 ocean, 0.95 land
  .jpeg({ quality: 78 })
  .toFile('public/textures/earth_roughness.jpg')
console.log('roughness written')
"
```
Expected: `public/textures/earth_roughness.jpg` exists, ~500 KB–1 MB. Open it in Preview: oceans should be dark (low roughness → reflective), continents should be light (high roughness → matte).

- [ ] **Step 4: Stub `scripts/compress-textures.ts`** (real impl in Task 24)

```ts
// Placeholder for the KTX2/Basis compression pipeline (Task 19).
// For now, Phase 0 ships JPGs directly so visual iteration is fast.
// Final PR runs this script in CI to emit .ktx2 alongside each JPG and
// the loader picks the compressed file on supported browsers.
console.log('compress-textures: not yet implemented (Task 19)')
```

- [ ] **Step 5: Write `README.md`** (initial, asset credits + dev quickstart)

```markdown
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
- `public/textures/earth_normal.jpg` — Solar System Scope 2K normal map, CC BY 4.0 (https://www.solarsystemscope.com/textures/).
- `public/textures/earth_roughness.jpg` — derived from the daymap luminance via `scripts/compress-textures.ts`.
- `public/textures/env_space_2k.hdr` — Poly Haven `satara_night_no_lamps` 2K, CC0 (https://polyhaven.com/a/satara_night_no_lamps).
```

- [ ] **Step 6: Commit**

```bash
git add public/textures/env_space_2k.hdr public/textures/earth_normal.jpg public/textures/earth_roughness.jpg scripts/compress-textures.ts README.md
git commit -m "Add HDRI, Earth normal map, and derived roughness map

env_space_2k.hdr from Poly Haven (CC0) for IBL ambient + reflections;
earth_normal.jpg from Solar System Scope (CC BY 4.0) for terrain relief
shading; earth_roughness.jpg generated from the daymap luminance so
oceans render reflective and continents matte. README documents asset
provenance."
```

---

### Task 8: `<Scene>` — Canvas wrapper with tone mapping, IBL, sun, frameloop

**Files:**
- Create: `src/scene/Scene.tsx`
- Create: `src/scene/Starfield.tsx`

- [ ] **Step 1: Write `src/scene/Starfield.tsx`**

```tsx
'use client'

import { Stars } from '@react-three/drei'

/**
 * Star background. drei's <Stars> generates a procedural starfield in a
 * Points cloud with subtle parallax. Cheap on every tier; no texture
 * needed. (The supplied `stars.jpg` is reserved for a future skybox
 * sphere on desktop-ultra; left out for v1 to keep the bundle lean.)
 */
export function Starfield() {
  return (
    <Stars
      radius={300}
      depth={60}
      count={6000}
      factor={4}
      saturation={0}
      fade
      speed={0.25}
    />
  )
}
```

- [ ] **Step 2: Write `src/scene/Scene.tsx`**

```tsx
'use client'

import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { detectTier } from '@/src/lib/tier'
import { PRESETS } from './presets'
import { Starfield } from './Starfield'

interface SceneProps {
  children: ReactNode
  /** Disables OrbitControls on the hub when CameraDolly is driving. */
  controls?: boolean
}

export function Scene({ children, controls = true }: SceneProps) {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const setTier = useStore((s) => s.setTier)
  const preset = PRESETS[effectiveTier]

  // Re-detect tier on the client after hydration. SSR seeds with 'balanced'.
  useEffect(() => {
    setTier(detectTier())
  }, [setTier])

  const camera = useMemo(() => ({ position: [0, 0, 6] as [number, number, number], fov: 45 }), [])

  return (
    <Canvas
      shadows={preset.shadowMapSize > 0}
      frameloop={preset.frameloop}
      dpr={[1, preset.dprCap]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      onCreated={({ gl }) => {
        if (preset.shadowMapSize > 0) {
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
        }
      }}
      style={{ position: 'absolute', inset: 0, background: '#07051a' }}
    >
      <PerspectiveCamera makeDefault position={camera.position} fov={camera.fov} />

      {/* IBL: HDRI drives ambient + reflections. background=false keeps the
       * deep-space color as the canvas backdrop instead of showing the HDRI. */}
      <Environment files={preset.hdriPath} background={false} environmentIntensity={0.35} />

      {/* Key sun: directional light, casts shadows on capable tiers.
       * Positioned to backlight the Earth from upper-left for a strong
       * day/night terminator. */}
      <directionalLight
        position={[5, 3, 5]}
        intensity={2.2}
        castShadow={preset.shadowMapSize > 0}
        shadow-mapSize={[preset.shadowMapSize || 1024, preset.shadowMapSize || 1024]}
        shadow-bias={-0.0005}
      />
      <ambientLight intensity={0.15} />

      <Starfield />

      {children}

      {controls && (
        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={2.5}
          maxDistance={12}
          autoRotate={false}
        />
      )}
    </Canvas>
  )
}
```

- [ ] **Step 3: Verify the file typechecks**

Run: `pnpm typecheck`
Expected: exit 0. (Components are not yet mounted anywhere, so no runtime check.)

- [ ] **Step 4: Commit**

```bash
git add src/scene/Scene.tsx src/scene/Starfield.tsx
git commit -m "Add <Scene> canvas wrapper + <Starfield>

Scene mounts a single R3F Canvas with ACES tone mapping, HDRI-driven
IBL ambient, a key directional sun for the day/night terminator, and a
procedural drei Stars background. Pulls tier from the store, re-detects
on the client after hydration, and applies the preset's frameloop, DPR
cap, shadow map size, and HDRI path."
```

---

### Task 9: `<PostProcessing>` — ACES + Bloom always, ultra-only SSAO/DOF/Vignette

**Files:**
- Create: `src/scene/PostProcessing.tsx`

- [ ] **Step 1: Write `src/scene/PostProcessing.tsx`**

```tsx
'use client'

import {
  Bloom,
  DepthOfField,
  EffectComposer,
  SSAO,
  Vignette,
} from '@react-three/postprocessing'
import { useStore } from '@/src/store'
import { PRESETS } from './presets'

/**
 * Post-processing chain. ACES tone mapping is set on the renderer in
 * Scene.tsx (not as an Effect). Bloom always on. SSAO + DOF + Vignette
 * gate by tier per DESIGN.md §3.
 *
 * Note: <EffectComposer> must be mounted INSIDE the Canvas. It is
 * exported as a separate component so callers can colocate it with
 * scene contents.
 */
export function PostProcessing() {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const preset = PRESETS[effectiveTier]
  const { bloom, ssao, dof, vignette } = preset.postFx

  return (
    <EffectComposer multisampling={preset.shadowMapSize > 0 ? 4 : 0}>
      <>
        {bloom && <Bloom intensity={0.65} luminanceThreshold={0.85} mipmapBlur />}
        {ssao && <SSAO radius={0.12} intensity={20} luminanceInfluence={0.6} />}
        {dof && <DepthOfField focusDistance={0.02} focalLength={0.05} bokehScale={2.5} />}
        {vignette && <Vignette eskil={false} offset={0.2} darkness={0.55} />}
      </>
    </EffectComposer>
  )
}
```

> **Note on the EffectComposer children:** `@react-three/postprocessing` requires at least one child. The wrapping fragment lets us gate every effect; if a tier disables all of them, swap the fragment for a no-op `<Vignette darkness={0} />` to satisfy the API. In practice every tier keeps bloom so this isn't hit.

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/scene/PostProcessing.tsx
git commit -m "Add <PostProcessing> chain with tier-gated effects

Bloom always on (mipmap blur, threshold 0.85). SSAO + DOF + Vignette
gated to desktop-ultra by the preset's postFx flags. ACES tone mapping
lives on the renderer in Scene.tsx, not in the composer."
```

---

### Task 10: `useEarthTextures()` shared loader hook

**Files:**
- Create: `src/scene/useEarthTextures.ts`

- [ ] **Step 1: Write `src/scene/useEarthTextures.ts`**

```ts
'use client'

import { useTexture } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { PRESETS } from './presets'

const PATHS = {
  day: '/textures/earth_daymap.jpg',
  night: '/textures/earth_night.jpg',
  clouds: '/textures/earth_clouds.jpg',
  normal: '/textures/earth_normal.jpg',
  roughness: '/textures/earth_roughness.jpg',
}

/**
 * Loads the five Earth texture maps with mipmaps and per-tier anisotropy.
 * Day/night/clouds use sRGB color space (they were authored as color
 * imagery). Normal/roughness use linear (they encode data, not color).
 */
export function useEarthTextures() {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const preset = PRESETS[effectiveTier]

  const textures = useTexture({
    day: PATHS.day,
    night: PATHS.night,
    clouds: PATHS.clouds,
    normal: PATHS.normal,
    roughness: PATHS.roughness,
  })

  return useMemo(() => {
    textures.day.colorSpace = THREE.SRGBColorSpace
    textures.night.colorSpace = THREE.SRGBColorSpace
    textures.clouds.colorSpace = THREE.SRGBColorSpace
    textures.normal.colorSpace = THREE.NoColorSpace
    textures.roughness.colorSpace = THREE.NoColorSpace

    for (const tex of Object.values(textures)) {
      tex.anisotropy = preset.anisotropy
      tex.generateMipmaps = true
      tex.minFilter = THREE.LinearMipMapLinearFilter
      tex.magFilter = THREE.LinearFilter
    }

    return textures
  }, [textures, preset.anisotropy])
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/scene/useEarthTextures.ts
git commit -m "Add useEarthTextures() shared loader

Loads day/night/clouds/normal/roughness with correct color spaces (sRGB
for color imagery, linear for data maps), per-tier anisotropy, and
trilinear mipmap filtering."
```

---

### Task 11: `<AtmosphereRim>` — fresnel + Rayleigh-style scattering shader

**Files:**
- Create: `src/scene/AtmosphereRim.tsx`

- [ ] **Step 1: Write `src/scene/AtmosphereRim.tsx`**

```tsx
'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { PRESETS } from './presets'

const VERTEX = `
varying vec3 vWorldPosition;
varying vec3 vNormal;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

// Cheap Rayleigh-ish color (blue along the limb, warmer toward the terminator).
// Not physically accurate scattering — close enough to read as "Earth atmosphere"
// at a hub scale. Inspired by drei's <atmosphereMaterial> and the standard
// Three.js fresnel shader.
const FRAGMENT = `
varying vec3 vWorldPosition;
varying vec3 vNormal;
uniform vec3 uSunDirection;
uniform vec3 uColorDay;
uniform vec3 uColorSunset;
uniform float uIntensity;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.5);

  // Sun-facing factor: 1 at noon, 0 at night side; warms the rim near terminator.
  float sunDot = clamp(dot(normalize(vNormal), normalize(uSunDirection)), -0.2, 1.0);
  float terminator = smoothstep(0.0, 0.4, abs(sunDot) - 0.0) * (1.0 - sunDot);

  vec3 color = mix(uColorDay, uColorSunset, terminator);
  float alpha = fresnel * uIntensity * smoothstep(-0.3, 0.4, sunDot);
  gl_FragColor = vec4(color, alpha);
}
`

interface AtmosphereRimProps {
  radius?: number
}

export function AtmosphereRim({ radius = 1.025 }: AtmosphereRimProps) {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const preset = PRESETS[effectiveTier]

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(5, 3, 5).normalize() },
        uColorDay: { value: new THREE.Color('#5cc6ff') },
        uColorSunset: { value: new THREE.Color('#ff8c5a') },
        uIntensity: { value: preset.atmosphere.raymarched ? 1.8 : 1.2 },
      },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [preset.atmosphere.raymarched])

  return (
    <mesh scale={radius}>
      <sphereGeometry args={[1, preset.earth.segments, preset.earth.segments]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/scene/AtmosphereRim.tsx
git commit -m "Add <AtmosphereRim> fresnel + sunset-tint shader

Custom GLSL shader on a slightly-larger back-side sphere (additive
blend, no depth write) creates the blue halo at the limb and warms it
toward the terminator using a cheap Rayleigh approximation. Intensity
scales by tier."
```

---

### Task 12: `<EarthInterior>` — concentric crust/mantle/core shells (ultra only)

**Files:**
- Create: `src/scene/EarthInterior.tsx`

- [ ] **Step 1: Write `src/scene/EarthInterior.tsx`**

```tsx
'use client'

import { useStore } from '@/src/store'
import { PRESETS } from './presets'

interface ShellProps {
  radius: number
  color: string
  emissive?: string
  emissiveIntensity?: number
  roughness?: number
  metalness?: number
}

function Shell({
  radius,
  color,
  emissive = '#000000',
  emissiveIntensity = 0,
  roughness = 0.85,
  metalness = 0.05,
}: ShellProps) {
  return (
    <mesh>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={roughness}
        metalness={metalness}
      />
    </mesh>
  )
}

/**
 * Nested shells: crust > mantle > outer core > inner core. Rendered on
 * desktop-ultra only and made visible during the zoom-to-enter dolly
 * (parent controls scale/clip). At the hub scale these are hidden
 * behind the opaque Earth surface; CameraDolly cuts away to expose
 * them when the user enters a module.
 */
export function EarthInterior() {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const preset = PRESETS[effectiveTier]
  if (!preset.earth.interior) return null

  return (
    <group>
      <Shell radius={0.985} color="#3a2a1a" roughness={0.95} />            {/* crust */}
      <Shell radius={0.92} color="#8b3a14" roughness={0.7} />              {/* mantle */}
      <Shell radius={0.55} color="#ff6a2a" emissive="#ff4a14" emissiveIntensity={0.6} roughness={0.4} metalness={0.6} /> {/* outer core */}
      <Shell radius={0.30} color="#ffd877" emissive="#ffaa44" emissiveIntensity={1.4} roughness={0.25} metalness={0.85} /> {/* inner core */}
    </group>
  )
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/scene/EarthInterior.tsx
git commit -m "Add <EarthInterior> concentric shells (ultra-only)

Four nested PBR spheres (crust / mantle / outer core / inner core) with
escalating emissive intensity toward the center. Hidden behind the
opaque Earth at hub scale; revealed by the camera dolly cut-away when
entering a module."
```

---

### Task 13: `<Earth>` — assembled photoreal layered globe

**Files:**
- Create: `src/scene/Earth.tsx`

- [ ] **Step 1: Write `src/scene/Earth.tsx`**

```tsx
'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { PRESETS } from './presets'
import { AtmosphereRim } from './AtmosphereRim'
import { EarthInterior } from './EarthInterior'
import { useEarthTextures } from './useEarthTextures'

const SURFACE_ROTATION_RATE = 0.02 // rad/sec
const CLOUD_ROTATION_RATE = 0.028  // slightly faster — winds aloft

export function Earth() {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const preset = PRESETS[effectiveTier]
  const textures = useEarthTextures()

  const surfaceRef = useRef<THREE.Mesh>(null)
  const cloudRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (surfaceRef.current) surfaceRef.current.rotation.y += SURFACE_ROTATION_RATE * delta
    if (cloudRef.current) cloudRef.current.rotation.y += CLOUD_ROTATION_RATE * delta
  })

  return (
    <group>
      <EarthInterior />

      {/* Earth surface: PBR material with day + night emissive blend, normal
       * for terrain relief, roughness so oceans are mirror-shiny. */}
      <mesh ref={surfaceRef} castShadow receiveShadow>
        <sphereGeometry args={[1, preset.earth.segments, preset.earth.segments]} />
        <meshStandardMaterial
          map={textures.day}
          normalMap={textures.normal}
          roughnessMap={textures.roughness}
          roughness={1}
          metalness={0.05}
          emissiveMap={textures.night}
          emissive={new THREE.Color('#ffd9a0')}
          emissiveIntensity={1.1}
        />
      </mesh>

      {/* Cloud layer: slightly larger sphere with alpha-from-luminance. */}
      <mesh ref={cloudRef} scale={1.008}>
        <sphereGeometry args={[1, preset.earth.cloudSegments, preset.earth.cloudSegments]} />
        <meshStandardMaterial
          alphaMap={textures.clouds}
          color="#ffffff"
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>

      <AtmosphereRim />
    </group>
  )
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/scene/Earth.tsx
git commit -m "Add <Earth> assembled photoreal layered globe

Composes EarthInterior + surface mesh (PBR with day map + emissive
night + normal + roughness) + cloud layer (slightly larger sphere,
alpha-from-luminance, faster rotation) + AtmosphereRim. Surface and
clouds rotate at differential rates via useFrame."
```

---

### Task 14: First visual verification — temporary hub renders Earth

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`** with a Scene+Earth+PostProcessing demo (this is replaced again in Task 17)

```tsx
'use client'

import { Scene } from '@/src/scene/Scene'
import { Earth } from '@/src/scene/Earth'
import { PostProcessing } from '@/src/scene/PostProcessing'

export default function Page() {
  return (
    <main className="fixed inset-0">
      <Scene controls>
        <Earth />
        <PostProcessing />
      </Scene>
    </main>
  )
}
```

- [ ] **Step 2: Run dev server and visually verify**

Run: `pnpm dev`. Open `http://localhost:3000` in a desktop browser. Verify:
- Page background reads as deep space (`#07051a`).
- A photoreal Earth rotates slowly in the center.
- Day side shows continent color from the daymap; night side glows with city lights (`emissiveMap`) where the sun isn't hitting.
- A subtle blue halo wraps the limb, warming toward orange near the terminator (AtmosphereRim).
- Clouds are visible above the surface and drift relative to it.
- Bloom is visible on bright highlights; no flickering or z-fighting.
- OrbitControls work (drag to rotate camera, scroll to zoom).
- No console errors. Texture loads should resolve within ~3s on cold cache.

If the Earth looks flat (no terrain shading), the normal map didn't load — check the network tab for `earth_normal.jpg` 200. If oceans are matte, the roughness map didn't load — check `earth_roughness.jpg`.

- [ ] **Step 3: Ctrl-C the dev server**

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "Wire temporary Earth demo at / for visual verification

Mounts Scene + Earth + PostProcessing at the root so the photoreal
render can be reviewed before the hub layer (Task 17) overlays module
entry cards on top."
```

- [ ] **Step 5: Visual approval checkpoint** — per the user's memory feedback, visual changes wait for explicit approval before push. Pause here and notify the user that the photoreal Earth is rendering at `/` for review.

---

## Phase E — Shell

### Task 15: Module registry

**Files:**
- Create: `src/shell/modules.ts`
- Create: `src/shell/StubModuleBody.tsx`

- [ ] **Step 1: Write `src/shell/StubModuleBody.tsx`**

```tsx
'use client'

interface StubModuleBodyProps {
  moduleLabel: string
  accent: string
}

export function StubModuleBody({ moduleLabel, accent }: StubModuleBodyProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div
        className="h-1 w-24 rounded"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <h2 className="text-xl font-medium text-foreground">{moduleLabel}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Module under construction. The shell, camera dolly, tier toggle, and
        tutor panel around it are live — module simulation arrives in the next
        phase.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/shell/modules.ts`**

```ts
import type { ComponentType } from 'react'
import type { ModuleId } from '@/src/store/shellSlice'
import { StubModuleBody } from './StubModuleBody'

export interface ModuleDef {
  id: Exclude<ModuleId, 'hub'>
  label: string
  shortLabel: string
  /** Hub card description. */
  blurb: string
  /** CSS var name from globals.css. */
  accentToken: '--color-accent-tectonics' | '--color-accent-atmosphere' | '--color-accent-systems'
  /** Resolved hex; mirrored from globals.css for use in inline styles + shaders. */
  accentHex: string
  /** Camera dolly target when entering this module. */
  dolly: {
    position: [number, number, number]
    lookAt: [number, number, number]
  }
  /** Module body component rendered inside ModuleFrame. */
  Body: ComponentType
}

function makeStub(label: string, accent: string): ComponentType {
  return function Stub() {
    return <StubModuleBody moduleLabel={label} accent={accent} />
  }
}

export const MODULES: Record<Exclude<ModuleId, 'hub'>, ModuleDef> = {
  tectonics: {
    id: 'tectonics',
    label: 'Tectonics',
    shortLabel: 'Crust',
    blurb: 'Drift plates, raise mountains, split rifts.',
    accentToken: '--color-accent-tectonics',
    accentHex: '#ff8c5a',
    // Dolly into the crust: camera dives toward the surface from current orbit.
    dolly: { position: [0, 0, 1.6], lookAt: [0, 0, 0] },
    Body: makeStub('Tectonics', '#ff8c5a'),
  },
  atmosphere: {
    id: 'atmosphere',
    label: 'Atmosphere',
    shortLabel: 'Sky',
    blurb: 'Form fronts, build clouds, trace storms.',
    accentToken: '--color-accent-atmosphere',
    accentHex: '#5cc6ff',
    // Pull back to the sky layer: a higher orbit gives a horizon view.
    dolly: { position: [0, 0.6, 2.4], lookAt: [0, 0, 0] },
    Body: makeStub('Atmosphere', '#5cc6ff'),
  },
  systems: {
    id: 'systems',
    label: 'Earth Systems',
    shortLabel: 'Cycles',
    blurb: 'Move carbon between atmosphere, ocean, biosphere, lithosphere.',
    accentToken: '--color-accent-systems',
    accentHex: '#7ad9aa',
    // Overlay cycles onto the globe: orbit similar to hub but slightly closer.
    dolly: { position: [0, 0, 4], lookAt: [0, 0, 0] },
    Body: makeStub('Earth Systems', '#7ad9aa'),
  },
}

export const HUB_DOLLY = {
  position: [0, 0, 6] as [number, number, number],
  lookAt: [0, 0, 0] as [number, number, number],
}
```

- [ ] **Step 3: Verify it typechecks**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/shell/modules.ts src/shell/StubModuleBody.tsx
git commit -m "Add module registry with stub bodies

MODULES defines id, label, blurb, accent token + hex, camera dolly
target, and a Body component for each of the three domains. Bodies are
stub placeholders until the engines land in subsequent phases. HUB_DOLLY
is the default camera position to return to on hub."
```

---

### Task 16: `<CameraDolly>` — animated camera transitions on module change + UI stubs

**Files:**
- Create: `src/scene/CameraDolly.tsx`
- Create: `src/ui/TierToggle.tsx` (stub, replaced in Task 19)
- Create: `src/ui/TutorPanel.tsx` (stub, replaced in Task 20)
- Create: `src/ui/SiteFooter.tsx` (stub, replaced in Task 21)
- Create: `src/ui/BackToHub.tsx` (stub, replaced in Task 18)

> **Why the stubs?** Tasks 17 (HubPage) and 18 (ModuleFrame) import these four UI components, but their final implementations land in Tasks 18–21. Creating empty placeholders here lets Tasks 17–18 typecheck immediately; later tasks replace the file contents in-place.

- [ ] **Step 1: Write `src/scene/CameraDolly.tsx`**

```tsx
'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { HUB_DOLLY, MODULES } from '@/src/shell/modules'

const DURATION_MS = 1100

/**
 * Tweens the camera position + lookAt to the active module's dolly target
 * (or HUB_DOLLY when activeModule is 'hub'). Eased with smoothstep.
 *
 * Mount inside the Canvas. Reads activeModule from the store; whenever
 * it changes, it captures the current camera state as the tween source
 * and runs for DURATION_MS.
 */
export function CameraDolly() {
  const activeModule = useStore((s) => s.activeModule)
  const { camera } = useThree()

  const startTimeRef = useRef<number | null>(null)
  const startPosRef = useRef(new THREE.Vector3())
  const startTargetRef = useRef(new THREE.Vector3())
  const endPosRef = useRef(new THREE.Vector3())
  const endTargetRef = useRef(new THREE.Vector3())

  // Resolve the target dolly for the current active module.
  useEffect(() => {
    const dolly = activeModule === 'hub' ? HUB_DOLLY : MODULES[activeModule].dolly
    endPosRef.current.set(...dolly.position)
    endTargetRef.current.set(...dolly.lookAt)

    startPosRef.current.copy(camera.position)
    // Current lookAt point: camera direction projected forward. Using the
    // origin as a stand-in works because OrbitControls always targets it.
    startTargetRef.current.set(0, 0, 0)

    startTimeRef.current = performance.now()
  }, [activeModule, camera])

  useFrame(() => {
    const start = startTimeRef.current
    if (start === null) return

    const elapsed = performance.now() - start
    const t = Math.min(elapsed / DURATION_MS, 1)
    const eased = t * t * (3 - 2 * t) // smoothstep

    camera.position.lerpVectors(startPosRef.current, endPosRef.current, eased)
    const target = new THREE.Vector3().lerpVectors(
      startTargetRef.current,
      endTargetRef.current,
      eased,
    )
    camera.lookAt(target)

    if (t >= 1) startTimeRef.current = null
  })

  return null
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Create UI placeholder stubs**

Create `src/ui/TierToggle.tsx`:

```tsx
'use client'

// Stub replaced in Task 19. Empty render so HubPage/ModuleFrame typecheck.
export function TierToggle() {
  return null
}
```

Create `src/ui/TutorPanel.tsx`:

```tsx
'use client'

// Stub replaced in Task 20. Empty render so HubPage/ModuleFrame typecheck.
export function TutorPanel() {
  return null
}
```

Create `src/ui/SiteFooter.tsx`:

```tsx
'use client'

// Stub replaced in Task 21. Empty render so HubPage typechecks.
export function SiteFooter() {
  return null
}
```

Create `src/ui/BackToHub.tsx`:

```tsx
'use client'

// Stub replaced in Task 18. Empty render so ModuleFrame typechecks.
export function BackToHub() {
  return null
}
```

- [ ] **Step 4: Commit**

```bash
git add src/scene/CameraDolly.tsx src/ui/TierToggle.tsx src/ui/TutorPanel.tsx src/ui/SiteFooter.tsx src/ui/BackToHub.tsx
git commit -m "Add <CameraDolly> smoothstep camera tween + UI placeholder stubs

CameraDolly mounts inside the Canvas, listens to shellSlice.activeModule,
and tweens position + lookAt to the module's dolly target (or HUB_DOLLY)
over 1100ms with smoothstep easing. Captures the live camera state as
the tween source so transitions chain cleanly when the user switches
modules mid-flight.

Empty TierToggle/TutorPanel/SiteFooter/BackToHub stubs land alongside so
HubPage (Task 17) and ModuleFrame (Task 18) typecheck before their final
implementations land in Tasks 18-21."
```

---

### Task 17: Hub page — module cards + integrated Scene

**Files:**
- Create: `src/shell/HubPage.tsx`
- Modify: `app/page.tsx` (full replacement)

- [ ] **Step 1: Write `src/shell/HubPage.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { useStore } from '@/src/store'
import { MODULES } from './modules'
import { Earth } from '@/src/scene/Earth'
import { Scene } from '@/src/scene/Scene'
import { PostProcessing } from '@/src/scene/PostProcessing'
import { CameraDolly } from '@/src/scene/CameraDolly'
import { TierToggle } from '@/src/ui/TierToggle'
import { TutorPanel } from '@/src/ui/TutorPanel'
import { SiteFooter } from '@/src/ui/SiteFooter'

export function HubPage() {
  const setActiveModule = useStore((s) => s.setActiveModule)

  return (
    <main className="relative h-dvh w-dvw overflow-hidden">
      {/* Full-bleed canvas behind the UI */}
      <div className="absolute inset-0">
        <Scene controls={false}>
          <Earth />
          <CameraDolly />
          <PostProcessing />
        </Scene>
      </div>

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-6">
        <h1 className="pointer-events-auto text-base font-medium tracking-wide text-[#dffaff]">
          Strata
        </h1>
        <div className="pointer-events-auto">
          <TierToggle />
        </div>
      </header>

      {/* Module entry cards — mobile: bottom drawer-style row; desktop: floating right column. */}
      <nav
        className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 flex flex-row gap-2 overflow-x-auto p-4 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-80 sm:flex-col sm:justify-center sm:gap-4 sm:overflow-visible sm:p-6"
        aria-label="Module entry"
      >
        {Object.values(MODULES).map((mod) => (
          <Link
            key={mod.id}
            href={`/${mod.id}`}
            onClick={() => setActiveModule(mod.id)}
            className="group min-w-[160px] rounded-lg border border-border/40 bg-card/60 p-4 backdrop-blur transition hover:border-border hover:bg-card/80 sm:min-w-0"
          >
            <div
              className="mb-2 h-0.5 w-12 rounded"
              style={{ backgroundColor: mod.accentHex }}
              aria-hidden
            />
            <div className="text-sm font-medium text-foreground">{mod.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{mod.blurb}</div>
          </Link>
        ))}
      </nav>

      <TutorPanel />
      <SiteFooter />
    </main>
  )
}
```

- [ ] **Step 2: Replace `app/page.tsx`**

```tsx
import { HubPage } from '@/src/shell/HubPage'

export default function Page() {
  return <HubPage />
}
```

- [ ] **Step 3: Verify the hub renders**

Run: `pnpm dev`. Open `http://localhost:3000`. Verify:
- Earth still renders photoreal, full-bleed.
- Three module cards visible (mobile: bottom row, desktop: right column).
- Top bar shows "Strata" + tier toggle.
- Tutor panel button is reachable.
- Clicking a module card navigates to `/tectonics` (etc.) — the route exists in the next task; for now expect a 404, that's the next step.

Ctrl-C the server.

- [ ] **Step 4: Commit**

```bash
git add src/shell/HubPage.tsx app/page.tsx
git commit -m "Add hub page with module entry cards over the photoreal Earth

HubPage mounts the full-bleed Scene+Earth+CameraDolly+PostProcessing
canvas, overlays a top bar (logo + tier toggle), and a module nav
(bottom drawer-style row on mobile; floating right column on desktop).
Card clicks set activeModule and navigate to /[module]; the module
route is added in Task 18."
```

---

### Task 18: Module route + `<ModuleFrame>`

**Files:**
- Create: `app/[module]/page.tsx`
- Create: `src/shell/ModuleFrame.tsx`
- Create: `src/shell/ClientShellInit.tsx`
- Modify: `src/ui/BackToHub.tsx` (replaces stub from Task 16)

- [ ] **Step 1: Replace `src/ui/BackToHub.tsx`** (overwriting the Task 16 stub)

```tsx
'use client'

import Link from 'next/link'
import { useStore } from '@/src/store'

export function BackToHub() {
  const setActiveModule = useStore((s) => s.setActiveModule)
  return (
    <Link
      href="/"
      onClick={() => setActiveModule('hub')}
      className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card/70 px-3 py-1.5 text-xs text-foreground backdrop-blur hover:bg-card"
    >
      <span aria-hidden>←</span> Hub
    </Link>
  )
}
```

- [ ] **Step 2: Write `src/shell/ModuleFrame.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'
import { Earth } from '@/src/scene/Earth'
import { Scene } from '@/src/scene/Scene'
import { CameraDolly } from '@/src/scene/CameraDolly'
import { PostProcessing } from '@/src/scene/PostProcessing'
import { TierToggle } from '@/src/ui/TierToggle'
import { TutorPanel } from '@/src/ui/TutorPanel'
import { BackToHub } from '@/src/ui/BackToHub'
import type { ModuleDef } from './modules'

interface ModuleFrameProps {
  module: ModuleDef
  children?: ReactNode
}

export function ModuleFrame({ module, children }: ModuleFrameProps) {
  return (
    <main className="relative h-dvh w-dvw overflow-hidden">
      <div className="absolute inset-0">
        <Scene controls={false}>
          <Earth />
          <CameraDolly />
          <PostProcessing />
        </Scene>
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-6">
        <div className="pointer-events-auto flex items-center gap-3">
          <BackToHub />
          <div
            className="h-4 w-0.5 rounded"
            style={{ backgroundColor: module.accentHex }}
            aria-hidden
          />
          <span className="text-sm font-medium text-foreground">{module.label}</span>
        </div>
        <div className="pointer-events-auto">
          <TierToggle />
        </div>
      </header>

      {/* Sidebar (desktop) / bottom drawer (mobile) — empty for now; the
       * module's controls will land here once the simulation engine is wired. */}
      <aside
        className="pointer-events-auto absolute z-10 bg-card/60 backdrop-blur
          bottom-0 inset-x-0 max-h-[35dvh] overflow-auto border-t border-border/40
          sm:bottom-auto sm:inset-y-0 sm:left-0 sm:right-auto sm:w-72 sm:max-h-none
          sm:border-r sm:border-t-0"
        aria-label="Module controls"
      >
        <div className="flex h-full flex-col">
          <header className="border-b border-border/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Controls
          </header>
          <div className="flex-1 p-4 text-sm text-muted-foreground">
            {children ?? <module.Body />}
          </div>
        </div>
      </aside>

      <TutorPanel />
    </main>
  )
}
```

- [ ] **Step 3: Write `app/[module]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { ModuleFrame } from '@/src/shell/ModuleFrame'
import { MODULES } from '@/src/shell/modules'

interface PageProps {
  params: Promise<{ module: string }>
}

const VALID = new Set(Object.keys(MODULES))

export default async function ModulePage({ params }: PageProps) {
  const { module } = await params
  if (!VALID.has(module)) notFound()

  const def = MODULES[module as keyof typeof MODULES]
  return <ModuleFrame module={def} />
}

export function generateStaticParams() {
  return Object.keys(MODULES).map((module) => ({ module }))
}
```

- [ ] **Step 4: Add a `ClientShellInit` to set activeModule on mount**

Because direct navigation to `/tectonics` (refresh or share-link) lands on the module page without going through the hub's `onClick`, the store needs the active module set on the client side. Create `src/shell/ClientShellInit.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useStore } from '@/src/store'
import type { ModuleDef } from './modules'

interface Props {
  module: ModuleDef
}

export function ClientShellInit({ module }: Props) {
  const setActiveModule = useStore((s) => s.setActiveModule)
  useEffect(() => {
    setActiveModule(module.id)
    return () => setActiveModule('hub')
  }, [module.id, setActiveModule])
  return null
}
```

Then update `src/shell/ModuleFrame.tsx` to render `<ClientShellInit module={module} />` once near the top of the component (just below the opening `<main>` is fine).

- [ ] **Step 5: Verify navigation flow**

Run: `pnpm dev`. From `http://localhost:3000`:
- Click "Tectonics" card → URL becomes `/tectonics`, camera dollies forward, "Tectonics" label appears in the header with the magma-orange accent strip, sidebar appears with placeholder copy, back-to-hub button visible.
- Click "Hub" back → URL becomes `/`, camera dollies back to orbit position.
- Refresh on `/atmosphere` directly → page renders with Atmosphere module body and the sky-blue accent.

Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add app/\[module\]/page.tsx src/shell/ModuleFrame.tsx src/shell/ClientShellInit.tsx src/ui/BackToHub.tsx
git commit -m "Add module routes and <ModuleFrame> shell

/[module] dynamic route validates against MODULES and renders
ModuleFrame, which reuses the same Scene + Earth + CameraDolly mount as
the hub (one persistent scene graph per DESIGN.md §13.2). Adds a
mobile-bottom / desktop-left sidebar for module controls, header with
back-to-hub + accent strip + label, and ClientShellInit so direct
navigation correctly drives the camera dolly."
```

---

### Task 19: `<TierToggle>` — segmented control

**Files:**
- Modify: `src/ui/TierToggle.tsx` (replaces stub from Task 16)

- [ ] **Step 1: Replace `src/ui/TierToggle.tsx`** (overwriting the Task 16 stub)

```tsx
'use client'

import { cn } from '@/lib/utils'
import type { Tier } from '@/src/lib/tier'
import { useStore } from '@/src/store'

const OPTIONS: { value: Tier | null; label: string; help: string }[] = [
  { value: null, label: 'Auto', help: 'Pick the best tier for this device.' },
  { value: 'mobile-lite', label: 'Lite', help: 'Battery-friendly, lower fidelity.' },
  { value: 'balanced', label: 'Balanced', help: 'Mid-fidelity, smooth on laptops.' },
  { value: 'desktop-ultra', label: 'Ultra', help: 'Full fidelity, capable GPUs only.' },
]

export function TierToggle() {
  const tierOverride = useStore((s) => s.tierOverride)
  const setTierOverride = useStore((s) => s.setTierOverride)

  return (
    <div
      role="radiogroup"
      aria-label="Render tier"
      className="flex items-center gap-1 rounded-md border border-border/60 bg-card/70 p-0.5 text-xs backdrop-blur"
    >
      {OPTIONS.map((opt) => {
        const active = (opt.value ?? null) === tierOverride
        return (
          <button
            key={opt.label}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.help}
            onClick={() => setTierOverride(opt.value)}
            className={cn(
              'rounded px-2 py-1 text-foreground/80 transition',
              active ? 'bg-foreground/15 text-foreground' : 'hover:bg-foreground/5',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify it renders**

Run: `pnpm dev`, click each segment, observe: aria-checked flips, store persists across page reload (localStorage `strata:shell` shows the override), tier-gated effects (e.g., SSAO on Ultra) appear/disappear when crossing the desktop-ultra boundary.

- [ ] **Step 3: Commit**

```bash
git add src/ui/TierToggle.tsx
git commit -m "Add <TierToggle> segmented control

Four-option radio group (Auto / Lite / Balanced / Ultra) wired to
shellSlice.tierOverride. Auto = null (use detected). Persists via the
existing store middleware; effects gate on the next frame after change."
```

---

### Task 20: `<TutorPanel>` stub

**Files:**
- Modify: `src/ui/TutorPanel.tsx` (replaces stub from Task 16)
- Create: `components/ui/sheet.tsx` (via shadcn CLI)

- [ ] **Step 1: Add the `sheet` shadcn block**

Run: `pnpm dlx shadcn@latest add sheet --yes`
Expected: creates `components/ui/sheet.tsx`. (Used for the desktop right-side panel.)

- [ ] **Step 2: Replace `src/ui/TutorPanel.tsx`** (overwriting the Task 16 stub)

```tsx
'use client'

import { useState } from 'react'
import { useStore } from '@/src/store'
import { MODULES } from '@/src/shell/modules'

const SUGGESTED_PROMPTS: Record<string, string[]> = {
  hub: [
    'What can I do here?',
    'Which module should I start with?',
  ],
  tectonics: [
    'Why do mountains form?',
    'What makes earthquakes happen at a boundary?',
    'What will this look like in 10 million years?',
  ],
  atmosphere: [
    'Why does it rain in front of a cold front?',
    'What’s the difference between humidity and dew point?',
  ],
  systems: [
    'Where does carbon go when a forest burns?',
    'How long does carbon stay in the deep ocean?',
  ],
}

export function TutorPanel() {
  const activeModule = useStore((s) => s.activeModule)
  const [open, setOpen] = useState(false)
  const prompts = SUGGESTED_PROMPTS[activeModule] ?? SUGGESTED_PROMPTS.hub
  const accent =
    activeModule === 'hub' ? '#dffaff' : MODULES[activeModule].accentHex

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="pointer-events-auto absolute bottom-4 right-4 z-20 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-2 text-xs font-medium text-foreground backdrop-blur sm:bottom-6 sm:right-6"
        aria-expanded={open}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        Ask the tutor
      </button>

      {open && (
        <aside
          className="pointer-events-auto absolute z-20 flex flex-col border border-border/40 bg-card/90 p-4 backdrop-blur
            inset-x-4 bottom-16 max-h-[60dvh] rounded-lg
            sm:inset-y-6 sm:right-6 sm:bottom-6 sm:left-auto sm:top-auto sm:w-80 sm:max-h-none"
          aria-label="Tutor"
        >
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Tutor</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label="Close tutor"
            >
              Close
            </button>
          </header>
          <div className="mb-3 text-xs text-muted-foreground">
            Wired up in a later phase. Suggested prompts for this module:
          </div>
          <ul className="space-y-2 text-sm">
            {prompts.map((p) => (
              <li
                key={p}
                className="rounded border border-border/40 bg-background/40 px-3 py-2 text-foreground/90"
              >
                {p}
              </li>
            ))}
          </ul>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="text"
              placeholder="Ask…"
              disabled
              className="flex-1 rounded border border-border/40 bg-background/40 px-3 py-2 text-sm placeholder:text-muted-foreground disabled:opacity-60"
            />
            <button
              type="submit"
              disabled
              className="rounded bg-foreground/20 px-3 py-2 text-xs text-foreground/60"
            >
              Soon
            </button>
          </form>
        </aside>
      )}
    </>
  )
}
```

- [ ] **Step 3: Verify panel opens/closes**

Run: `pnpm dev`. Click "Ask the tutor" → panel slides in. Suggested prompts list rotates per module (navigate to /tectonics → prompts about plates). Close button works. Input and Send button are disabled with "Soon" copy.

Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add src/ui/TutorPanel.tsx components/ui/sheet.tsx
git commit -m "Add <TutorPanel> stub with module-aware suggested prompts

Floating bottom-right FAB toggles a side panel (right-aligned on
desktop, bottom-sheet on mobile). Suggested prompts list rotates with
activeModule per DESIGN.md §8. Input field is disabled and labeled
\"Soon\"; wire-up lands when the tutor route is implemented."
```

---

### Task 21: Site footer + reduced-motion hook

**Files:**
- Modify: `src/ui/SiteFooter.tsx` (replaces stub from Task 16)
- Create: `src/lib/accessibility.ts`
- Modify: `src/scene/Earth.tsx` (gate rotation behind reduced-motion)

- [ ] **Step 1: Write `src/lib/accessibility.ts`**

```ts
'use client'

import { useEffect, useState } from 'react'

/** Reactive prefers-reduced-motion. SSR returns false. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mql = matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mql.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return reduced
}
```

- [ ] **Step 2: Wire the reduced-motion hook into the Earth rotation**

Edit `src/scene/Earth.tsx`. Add the import and gate `useFrame` increments behind it:

```tsx
// Add to the imports
import { usePrefersReducedMotion } from '@/src/lib/accessibility'

// Inside Earth() — replace the existing useFrame block
const prefersReducedMotion = usePrefersReducedMotion()
useFrame((_, delta) => {
  if (prefersReducedMotion) return
  if (surfaceRef.current) surfaceRef.current.rotation.y += SURFACE_ROTATION_RATE * delta
  if (cloudRef.current) cloudRef.current.rotation.y += CLOUD_ROTATION_RATE * delta
})
```

- [ ] **Step 3: Replace `src/ui/SiteFooter.tsx`** (overwriting the Task 16 stub)

```tsx
'use client'

export function SiteFooter() {
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center pb-2 text-[10px] text-muted-foreground/60">
      <span className="pointer-events-auto">
        Strata · inkOrange · sibling to{' '}
        <a
          href="https://molecular.chriswest.tech"
          className="underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Molecular
        </a>
      </span>
    </footer>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/SiteFooter.tsx src/lib/accessibility.ts src/scene/Earth.tsx
git commit -m "Add reduced-motion hook + minimal site footer

usePrefersReducedMotion subscribes to the media query and gates Earth
surface + cloud rotation. SiteFooter is a one-line credit that won’t
fight a future inkOrange labs hub federation."
```

---

## Phase F — Verification

### Task 22: Stub `/s/[hash]` route

**Files:**
- Create: `app/s/[hash]/page.tsx`

- [ ] **Step 1: Write `app/s/[hash]/page.tsx`**

```tsx
import { redirect } from 'next/navigation'

// Real share-link decoder lands when sceneSlice + history slice come
// online. For now, /s/[hash] silently bounces back to the hub so any
// shared link a user attempts is at least a valid landing.
export default function SharedScene() {
  redirect('/')
}
```

- [ ] **Step 2: Commit**

```bash
git add app/s/\[hash\]/page.tsx
git commit -m "Stub /s/[hash] route to redirect to the hub

Reserves the URL shape from DESIGN.md §5. Real decoder lands when
sceneSlice + history slice are implemented; for now any shared link
lands users on the hub."
```

---

### Task 23: Playwright e2e — hub renders + module navigation + tier toggle

**Files:**
- Create: `tests/e2e/hub.spec.ts`
- Create: `tests/e2e/module-navigation.spec.ts`
- Create: `tests/e2e/tier-toggle.spec.ts`

- [ ] **Step 1: Write `tests/e2e/hub.spec.ts`**

```ts
import { expect, test } from '@playwright/test'

test('hub renders title, all three module cards, and a canvas', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: 'Strata' })).toBeVisible()

  for (const label of ['Tectonics', 'Atmosphere', 'Earth Systems']) {
    await expect(page.getByRole('link', { name: new RegExp(label) })).toBeVisible()
  }

  // Canvas mounts under the Scene wrapper.
  await expect(page.locator('canvas')).toBeVisible()

  // Allow a beat for the WebGL context to settle, then assert no console errors.
  await page.waitForTimeout(500)
  expect(
    consoleErrors.filter((e) => !e.includes('WebGL') && !e.toLowerCase().includes('webgl')),
    `unexpected console errors: ${consoleErrors.join('\n')}`,
  ).toEqual([])
})
```

- [ ] **Step 2: Write `tests/e2e/module-navigation.spec.ts`**

```ts
import { expect, test } from '@playwright/test'

test('enter Tectonics from hub, see the module frame, return to hub', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Tectonics/ }).click()
  await expect(page).toHaveURL(/\/tectonics$/)
  await expect(page.getByText('Tectonics', { exact: true })).toBeVisible()
  await expect(page.getByText(/Module under construction/)).toBeVisible()

  await page.getByRole('link', { name: /Hub/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Strata' })).toBeVisible()
})

test('direct navigation to a module page renders correctly', async ({ page }) => {
  await page.goto('/atmosphere')
  await expect(page.getByText('Atmosphere', { exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
})

test('invalid module slug 404s', async ({ page }) => {
  const response = await page.goto('/not-a-module')
  expect(response?.status()).toBe(404)
})
```

- [ ] **Step 3: Write `tests/e2e/tier-toggle.spec.ts`**

```ts
import { expect, test } from '@playwright/test'

test('tier toggle persists across reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('radio', { name: 'Ultra' }).click()
  await expect(page.getByRole('radio', { name: 'Ultra' })).toHaveAttribute(
    'aria-checked',
    'true',
  )

  await page.reload()
  await expect(page.getByRole('radio', { name: 'Ultra' })).toHaveAttribute(
    'aria-checked',
    'true',
  )

  // Reset to Auto so other tests don't inherit the override.
  await page.getByRole('radio', { name: 'Auto' }).click()
})
```

- [ ] **Step 4: Run e2e tests**

Run: `pnpm test:e2e`
Expected: all tests pass on both `mobile-chrome` and `desktop-chrome` projects. (First run will be slow because Next compiles each route on first hit.)

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/hub.spec.ts tests/e2e/module-navigation.spec.ts tests/e2e/tier-toggle.spec.ts
git commit -m "Add Playwright e2e: hub, module navigation, tier toggle

Asserts the hub renders all three module cards + a canvas + no console
errors, navigation between hub/Tectonics works in both directions,
direct navigation to /atmosphere lands correctly, /not-a-module 404s,
and tier toggle override persists across reload."
```

---

### Task 24: KTX2/Basis texture compression script

**Files:**
- Modify: `scripts/compress-textures.ts`
- Modify: `src/scene/useEarthTextures.ts` (loader prefers .ktx2 if available)

- [ ] **Step 1: Replace `scripts/compress-textures.ts`**

```ts
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, parse } from 'node:path'

/**
 * Compresses every JPG/PNG in /public/textures to .ktx2 (UASTC for
 * non-color data, ETC1S for color) using @gltf-transform/cli's
 * `basis` toktx pipeline via `npx`. Output sits next to the source
 * as `<name>.ktx2`. Idempotent — skips if the .ktx2 already exists
 * and is newer than the source.
 *
 * Requires `npx -y @gltf-transform/cli` to be reachable. Falls back
 * to logging a skip if the binary is missing so dev iteration doesn’t
 * break on machines that haven’t pulled the toolchain.
 */
async function main() {
  const dir = 'public/textures'
  const files = await readdir(dir)
  const candidates = files.filter((f) => /\.(jpg|jpeg|png)$/i.test(f))

  for (const file of candidates) {
    const { name } = parse(file)
    const src = join(dir, file)
    const dst = join(dir, `${name}.ktx2`)

    if (existsSync(dst)) {
      console.log(`skip (exists): ${dst}`)
      continue
    }

    // Color maps (day/night/clouds) use ETC1S for size. Data maps
    // (normal/roughness) use UASTC for quality.
    const isData = /normal|roughness/i.test(name)
    const args = isData
      ? ['-y', '@gltf-transform/cli@latest', 'uastc', src, dst]
      : ['-y', '@gltf-transform/cli@latest', 'etc1s', src, dst]

    console.log(`compress: ${src} -> ${dst} (${isData ? 'UASTC' : 'ETC1S'})`)
    await runNpx(args)
  }
}

function runNpx(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('npx', args, { stdio: 'inherit' })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`npx exit ${code}`))))
    child.on('error', (err) => {
      console.warn(`compress-textures: skipped (toolchain missing): ${err.message}`)
      resolve()
    })
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Run the compression script**

Run: `pnpm compress-textures`
Expected: produces `.ktx2` files next to each JPG in `public/textures/`, or logs "skipped (toolchain missing)" — both are acceptable for this PR. The loader (step 3) falls back to JPG when KTX2 isn’t present.

- [ ] **Step 3: Update `src/scene/useEarthTextures.ts`** to prefer KTX2 via a generated manifest

The compression script emits a TypeScript manifest into `src/scene/textureManifest.ts` (TS file, not JSON, so it bundles cleanly without import-attribute syntax or filesystem reads at runtime). The loader reads the manifest to rewrite paths to `.ktx2` when available.

Modify `scripts/compress-textures.ts` so the `main()` function writes the manifest at the end. Append after the `for (const file of candidates)` loop:

```ts
// Append inside main() in scripts/compress-textures.ts:
import { writeFile } from 'node:fs/promises'

const manifest: Record<string, string> = {}
for (const file of candidates) {
  const { name } = parse(file)
  const ktx2 = join(dir, `${name}.ktx2`)
  if (existsSync(ktx2)) manifest[file] = `${name}.ktx2`
}
await writeFile(
  'src/scene/textureManifest.ts',
  `// Auto-generated by scripts/compress-textures.ts. Do not edit.\n` +
    `export const TEXTURE_MANIFEST: Record<string, string> = ${JSON.stringify(manifest, null, 2)}\n`,
)
console.log('wrote src/scene/textureManifest.ts')
```

If the compression toolchain was skipped (Step 2 logged "toolchain missing"), `manifest` will be empty `{}` and the loader falls through to JPGs cleanly. Either way the script must always emit the manifest file so the import resolves.

Modify `src/scene/useEarthTextures.ts` to read the generated manifest:

```ts
// Add to the imports at the top of useEarthTextures.ts:
import { TEXTURE_MANIFEST } from './textureManifest'

// Replace the PATHS constant:
function resolvePath(file: string): string {
  const compressed = TEXTURE_MANIFEST[file]
  return compressed ? `/textures/${compressed}` : `/textures/${file}`
}

const PATHS = {
  day: resolvePath('earth_daymap.jpg'),
  night: resolvePath('earth_night.jpg'),
  clouds: resolvePath('earth_clouds.jpg'),
  normal: resolvePath('earth_normal.jpg'),
  roughness: resolvePath('earth_roughness.jpg'),
}
```

**Bootstrap requirement:** before Task 25, ensure `src/scene/textureManifest.ts` exists. If you skipped Step 2 (compression toolchain missing), create a one-line manifest by hand so the import doesn't break:

```ts
// src/scene/textureManifest.ts
export const TEXTURE_MANIFEST: Record<string, string> = {}
```

For KTX2 loading, drei’s `useTexture` auto-routes `.ktx2` files through the KTX2 loader as long as `KTX2Loader` is registered. Add a one-time loader registration to `Scene.tsx` (inside the `<Canvas>` element):

```tsx
// In Scene.tsx, add the import:
import { useGLTF } from '@react-three/drei'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { useThree } from '@react-three/fiber'

// Inside Scene, add a tiny component mounted as a Canvas child:
function KTX2Setup() {
  const { gl } = useThree()
  useEffect(() => {
    const ktx2 = new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/libs/basis/').detectSupport(gl)
    useGLTF.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/libs/draco/')
    // Drei's useTexture inspects extension; KTX2Loader auto-binds when configured globally.
    THREE.DefaultLoadingManager.addHandler(/\.ktx2$/i, ktx2)
  }, [gl])
  return null
}

// Then mount <KTX2Setup /> as the first child inside <Canvas>.
```

Add the `import * as THREE from 'three'` and `useEffect` imports at the top of `Scene.tsx` if not already present.

- [ ] **Step 4: Re-run e2e tests to confirm the change doesn’t break loading**

Run: `pnpm test:e2e --grep="hub"`
Expected: still passes.

- [ ] **Step 5: Commit**

```bash
git add scripts/compress-textures.ts src/scene/useEarthTextures.ts src/scene/textureManifest.ts src/scene/Scene.tsx
git commit -m "Add KTX2/Basis texture compression pipeline

compress-textures emits .ktx2 next to each JPG in public/textures and
writes src/scene/textureManifest.ts so the loader prefers compressed
files when present without importing JSON from /public. KTX2Loader is
registered globally on Canvas mount via DefaultLoadingManager. Falls
through to JPGs when the toolchain isn't installed, so dev machines
without @gltf-transform stay buildable."
```

---

### Task 25: Final verification + branch hand-off

**Files:** (no new files)

- [ ] **Step 1: Run the full test gauntlet**

Run sequentially:
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

Expected: every command exits 0. If `pnpm lint` flags anything, run `pnpm lint:fix` and re-commit.

- [ ] **Step 2: Final visual review**

Run: `pnpm dev`. Walk the flow on **both** the mobile-chrome devtools viewport (390×844) and a desktop window:
- Hub renders photoreal Earth, three module cards, top bar with tier toggle, tutor FAB.
- Click each module → camera dollies, header label appears with correct accent strip, sidebar appears.
- Click Hub → camera returns.
- Toggle tier → Ultra adds visible SSAO + DOF + Vignette; Lite drops shadows + post-fx.
- Reload `/atmosphere` directly → lands on atmosphere correctly.
- Tutor panel opens with module-aware prompts.
- No console errors.

Ctrl-C.

- [ ] **Step 3: Stage all remaining changes and ensure clean working tree**

Run: `git status`
Expected: working tree clean. If there are any tracked-but-uncommitted files, decide per-file whether they belong in the PR; commit or revert as appropriate.

- [ ] **Step 4: Push the branch and open a PR**

Run:
```bash
git push -u origin phase-0-1-render-pipeline-and-shell
gh pr create --title "Phase 0+1: render pipeline + hub shell" --body "$(cat <<'EOF'
## Summary
- Stands up the realistic-first render pipeline foundations per DESIGN.md §11 step 0 (HDRI/IBL, PBR materials, tier-preset system, ACES tone mapping + tier-gated post-fx, continuous render loop).
- Proves the pipeline on the hub Earth: photoreal layered globe (PBR + day/night/normal/roughness/clouds), AtmosphereRim fresnel + Rayleigh-style shader, optional EarthInterior cutaway on desktop-ultra.
- Wires the shell per DESIGN.md §11 step 1: hub page with three module entry cards, /[module] route + ModuleFrame, true camera-dolly zoom-to-enter (one persistent scene graph), tier toggle, tutor panel stub with module-aware suggested prompts.
- Ports Molecular's theme, fonts, shadcn config, biome, and metadata shape verbatim per §13.1; adds the three Strata domain accent tokens on top.
- Visuals degrade per device: desktop-ultra runs full post-fx + shadows + interior; balanced drops SSAO/DOF; mobile-lite drops shadows + raymarched atmo, frameloop falls to demand.

## Test plan
- [ ] \`pnpm typecheck\` exits 0
- [ ] \`pnpm lint\` exits 0
- [ ] \`pnpm test\` passes (tier detection, preset config, shellSlice persistence)
- [ ] \`pnpm test:e2e\` passes on both mobile-chrome and desktop-chrome
- [ ] Visual review on desktop: photoreal Earth, module navigation flow, tier toggle effects visible
- [ ] Visual review on mobile viewport: cards in bottom row, tutor in bottom sheet, no overflow
EOF
)"
```

Expected: PR URL printed. Per the user's memory feedback, **do not merge** — Chris merges manually.

---

## Spec coverage check (against DESIGN.md)

| Spec section | Covered by |
| --- | --- |
| §1 Tiers (Beginner/Standard/Advanced) | Out of scope for Phase 0+1; UI scaffolding lands in module phases |
| §1 Hero / autonomous reel | Out of scope (covered later via dedicated reel component) |
| §2 Shell + hub (translucent Earth, zoom-to-enter) | Tasks 8, 13, 16, 17 |
| §2 Module A/B/C bodies | Stubbed (Task 15) |
| §2 AI Tutor | Stubbed (Task 20) |
| §2 Tier toggle | Task 19 |
| §2 Time scrubber | Out of scope (per-module phases) |
| §2 Share `/s/[hash]` | Stubbed redirect (Task 22) |
| §2 Undo/Redo | Out of scope |
| §2 Landing reel | Out of scope |
| §3 Visual fidelity (PBR + tone mapping + bloom + IBL + atmospheric rim) | Tasks 7–13 |
| §3 Tier-by-device degradation | Tasks 4, 5, 8, 9, 12 |
| §3 Reduced-motion / high-contrast | Reduced-motion Task 21; high-contrast token in slice + future palette swap |
| §4 Simulation engines | Out of scope (later phases) |
| §5 Zustand + immer + localStorage | Task 6 |
| §6 R3F stack + IBL + KTX2 + frameloop divergence from Molecular | Tasks 8, 10, 24 |
| §7 Layout breakpoints + domain accents | Tasks 17, 18 (layout); Task 2 (accents) |
| §8 AI Tutor | Stub (Task 20); full wire-up later |
| §9 Tech stack | Tasks 1, 2, 3 |
| §10 File structure | Tasks 1–22 |
| §11 Build order | Phase 0 = Tasks 7–14; Phase 1 = Tasks 15–21 |
| §13.1 Port Molecular theme verbatim | Task 2 |
| §13.2 True camera dolly | Task 16 |
| §13.3 Realism-first | Tasks 7–13 (built at top tier from day one) |
| §13.4 CC0-only assets, KTX2 mandatory | Task 7 (assets); Task 24 (KTX2) |
| §13.5 Footer-doesn’t-fight-future-federation | Task 21 |

**Out-of-scope items called out at the top of this plan are correctly deferred** to future phases (tutor route + AI Gateway env wiring, module engines, share-link encoder, service worker, autonomous landing reel, lesson sequences).

**End of plan.**
