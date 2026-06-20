# AI Tutor — Design Spec

**Date:** 2026-06-19
**Module:** cross-cutting (all modules + hub)
**Status:** Approved design, ready for implementation plan
**Related:** DESIGN.md §8 (AI Tutor), §14.1 (shell). Reference implementation: the
sibling Molecular repo (`../molecular`).

---

## 1. Goal

Wire the Strata AI Tutor from its current UI-only stub into a working,
scene-grounded, tier-aware streaming chat. A student opens the tutor on any
module and asks "why did this happen?"; the model answers with awareness of the
current scene state, at a depth matched to the active tier. This completes design
success criterion #4 ("the AI tutor can answer 'why did this happen?' given the
current scene state").

## 2. Approach

Port Molecular's proven tutor architecture and adapt it to Strata's shape, rather
than invent a new one or adopt the AI SDK `useChat` hook. Strata already drives
all state through Zustand, so Molecular's manual fetch-stream-into-store pattern
fits and keeps the two apps readable as a matched set.

**Scope decisions (settled during brainstorming):**

- **Text-only streaming.** No "highlight" tool calls in v1 (the §8 idea of pulsing
  a referenced scene object is deferred). Matches Molecular's shipped tutor.
- **Reuse Molecular's gateway key.** The AI SDK reads `AI_GATEWAY_API_KEY` from
  the environment automatically; Strata's `.env.local` carries the same
  team-level key value Molecular uses.
- **Stateless per question.** Each request sends only the latest question + a
  fresh scene summary — no multi-turn history replay. Cheap, simple, sufficient
  for scene Q&A. (Matches Molecular.)

## 3. Components

| Unit | File | New/changed | Responsibility |
| --- | --- | --- | --- |
| API route | `app/api/tutor/route.ts` | new | Node runtime; validate payload; rate-limit; pick model by tier; `streamText` via AI Gateway; stream text back |
| Rate limiter | `src/lib/rateLimit.ts` | new (port verbatim) | In-memory sliding window, default 10/min/IP; `clientKey(req)` from `x-forwarded-for` |
| Tutor state | `src/tutor/tutorSlice.ts` | new (port) | `messages`, `streaming` + actions; wired into `src/store/index.ts` |
| Scene summarizer | `src/tutor/sceneToPrompt.ts` | new (Strata-specific) | Pure function: store snapshot → short grounding string per module |
| Chat UI | `src/ui/TutorPanel.tsx` | rewrite stub | Stream into store, render messages, suggestion chips, input, error handling; keep existing FAB + panel chrome |
| Env | `.env.local` | new (gitignored) | `AI_GATEWAY_API_KEY` copied from Molecular |
| Dep | `package.json` | changed | add `ai` ^6 |

### 3.1 API route — `app/api/tutor/route.ts`

- `export const runtime = 'nodejs'` (default Vercel/Fluid Compute; `streamText`
  buffers SSE itself, Node lets the Gateway resolve cleanly).
- Rate-limit first via `rateLimit(clientKey(req), { max: 10, windowMs: 60_000 })`;
  on block return `429` with a `retry-after` header.
- Zod payload schema:
  ```ts
  {
    sceneSummary: z.string().max(4000),
    module: z.enum(['tectonics', 'atmosphere', 'systems', 'hub']),
    tier: z.enum(['beginner', 'standard', 'advanced']),
    question: z.string().min(1).max(500),
  }
  ```
  Invalid → `400` with issues.
- Model by tier: `beginner` → `anthropic/claude-haiku-4-5`; `standard` /
  `advanced` → `anthropic/claude-sonnet-4-6`.
- `streamText({ model, system: systemPrompt(tier, module), prompt:
  \`Module: ${module}\n\n${sceneSummary}\n\nStudent question: ${question}\` })`
  then `return result.toTextStreamResponse()`.
- `systemPrompt(tier, module)`: base persona is "a friendly, accurate
  earth-science tutor inside an educational 3D app called Strata. You see the
  current scene as text and answer the student's question. Keep responses concise
  (3–6 sentences). Use plain text, no Markdown." Then a per-tier register clause:
  - *beginner*: middle / early-high-school; simple analogies; avoid jargon (e.g.
    say "the plates crash together" not "convergent boundary").
  - *standard*: high-school / AP earth-science terms (convergent boundary, dew
    point, residence time).
  - *advanced*: precise college terms (stress/strain, adiabatic lapse rate, flux,
    residence time).

  The `module` flavours one line of the persona ("The student is currently in the
  {Tectonics / Atmosphere / Earth Systems} module" / "on the home screen") so
  answers stay on-domain.

### 3.2 Rate limiter — `src/lib/rateLimit.ts`

Ported verbatim from Molecular: in-memory `Map<string, number[]>` sliding window,
opportunistic sweep, `rateLimit(key, opts)` → `{ allowed, retryAfterSec,
remaining }`, `clientKey(req)` (prefers `x-forwarded-for`, then `x-real-ip`, then
`'unknown'`), and `__resetRateLimitForTests()`.

### 3.3 Tutor state — `src/tutor/tutorSlice.ts`

Ported from Molecular's `tutorSlice`:

```ts
interface TutorMessage { role: 'user' | 'assistant'; content: string; ts: number }
state: { tutor: { messages: TutorMessage[]; streaming: boolean } }
actions: addTutorMessage(m), appendToLast(chunk), setStreaming(v), clearTutor()
```

Wired into `src/store/index.ts` alongside the existing shell/tectonics/atmosphere/
systems slices (follow the existing `create<Store>()` composition; `messages`
is NOT persisted to localStorage — only the shell slice persists today, leave that
as-is).

### 3.4 Scene summarizer — `src/tutor/sceneToPrompt.ts`

Pure function `sceneToPrompt(state): string` reading the relevant slice for the
active module. Deterministic (unit-testable). Examples:

- **hub:** `"The student is on the Strata home screen, choosing a module."`
- **tectonics:** uses the displayed era (`targetEraId ?? currentEraId`) →
  `"Viewing the {era.name} ({mya} million years ago / today / {n} million years from now). The continents and plates are shown for that era."`
- **atmosphere:** season + hour + active layers →
  `"24-hour day-cycle view. Season: {June solstice}. Local time at the sub-solar meridian: {14:00}. Visible layers: convection cells, cloud band."` (omit layers that are off; note when none are on).
- **systems:** scenario + levers + year + reservoir trend →
  `"Carbon-cycle sandbox. Scenario: {high-emissions}. Fossil-fuel emissions: {9.0} GtC/yr. Land use: {deforesting}. Year: {80}. The atmosphere reservoir is {rising}."`

Keep each summary to a few sentences; the route caps `sceneSummary` at 4000 chars
as a backstop.

### 3.5 Chat UI — `src/ui/TutorPanel.tsx`

Rewrite the disabled stub into a working streaming chat, preserving the current
FAB button + panel chrome/positioning (desktop right sheet / mobile bottom card)
and the existing per-module `SUGGESTED_PROMPTS`. Behaviour ported from Molecular's
`TutorPanel`:

- Subscribe to `tutor.messages`, `tutor.streaming`, `activeModule`,
  `tierOverride`, plus the slices `sceneToPrompt` needs.
- `ask(q)`: ignore if empty or already streaming; push user msg + empty assistant
  placeholder; `setStreaming(true)`; build `sceneSummary` from
  `useStore.getState()`; `POST /api/tutor`; read `res.body` reader, decode chunks,
  `appendToLast`; `finally setStreaming(false)`.
- Resolve tier from `tierOverride` (mobile-lite → beginner, desktop-ultra →
  advanced, balanced/null → standard). This mapping is currently **inlined** in
  `TectonicsBody`; extract it into a small shared helper (e.g.
  `tutorTier(tierOverride)` in `src/lib/tier.ts`) so `TutorPanel` and the route
  payload use one definition. Refactor `TectonicsBody` to call it too.
- Suggestion chips become clickable (call `ask`), disabled while streaming.
- Input + send disabled while streaming; Enter submits.
- Render the message log with auto-scroll to the newest token.

## 4. Data flow

```
user asks
  → addTutorMessage(user) + addTutorMessage(assistant placeholder)
  → setStreaming(true)
  → sceneSummary = sceneToPrompt(store)
  → POST /api/tutor { sceneSummary, module, tier, question }
      → rateLimit → (429?) 
      → zod validate → (400?)
      → streamText(model by tier, system by tier+module)
      → toTextStreamResponse()
  → client reads chunks → appendToLast(chunk)
  → setStreaming(false)
```

## 5. Error handling

| Condition | Behaviour |
| --- | --- |
| Rate limited (429) | Assistant message shows "Rate limit reached (10 questions per minute). Try again in {n}s." |
| Bad payload (400) | Should not happen from the real client; assistant shows "[Error fetching response]" |
| Non-OK / no body | "[Error fetching response]" |
| Network throw | "[Network error]" |
| Missing `AI_GATEWAY_API_KEY` | Route surfaces a 500; the client shows the generic error. Won't occur once the key is in `.env.local`. |

## 6. Testing

- **Unit (Vitest):**
  - `sceneToPrompt.spec.ts` — one deterministic-string assertion per module
    (hub, tectonics era, atmosphere season+layers, systems scenario+levers).
  - `rateLimit.spec.ts` — port Molecular's tests (allows under limit, blocks at
    limit, window expiry, `clientKey` header precedence).
  - `tutorSlice.spec.ts` — `addTutorMessage`, `appendToLast` grows last message,
    `setStreaming`, `clearTutor`.
  - tier→model mapping (a small pure helper, tested directly).
- **Route:** unit-level test that an invalid payload → 400 and an over-limit call
  → 429, without hitting the real model (call the exported handler with crafted
  `Request`s; reset rate-limit buckets between tests).
- **E2E (Playwright):** mock `/api/tutor` (route fulfillment) to return a canned
  text stream; open the tutor, click a suggestion / type a question, assert the
  streamed assistant text renders and the input is disabled while streaming. No
  real model calls in CI.
- **Manual:** real end-to-end streaming locally with the gateway key, one prompt
  per module, eyeballing tier differences.

## 7. Out of scope (YAGNI)

- Highlight / scene-object tool calls (deferred from §8).
- Multi-turn conversation memory (stateless per question).
- Cross-reload message persistence.
- Auth / per-user accounts (anonymous IP rate-limit only).

## 8. File-structure note

A new `src/tutor/` directory holds the tutor's non-UI units (`tutorSlice.ts`,
`sceneToPrompt.ts`, and their specs), mirroring how `src/atmos/`, `src/systems/`,
and `src/tectonics/` each own their slice + pure logic. The UI stays in
`src/ui/TutorPanel.tsx` (shared chrome) and the route in `app/api/tutor/`.
