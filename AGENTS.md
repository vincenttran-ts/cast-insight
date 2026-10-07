# AGENTS.md — CastInsight

Context for AI coding agents (Cursor, Claude Code, etc.) working in this repo.
Pairs with [README.md](README.md), which covers setup and the feature list.

## What this is

CastInsight is an internal UX-research tool for the Casting Networks design team.
Designers run automated **cognitive walkthroughs** of UI flows: an AI agent
adopts an entertainment-industry persona (Actor, Rep, Casting Director, or a
custom one) and "walks" a designer-defined flow step by step, emitting a
first-person monologue, an action, a frustration score, and UX issues per step.
Evaluation runs on the **Google Gemini API**, or fully offline via a built-in
**sandbox mock engine**.

## Run it

```bash
npm install            # root (concurrently only)
npm install --prefix backend
npm install --prefix frontend
npm run dev            # backend :3001 + frontend :5173 together
```

- `npm run dev:backend` / `npm run dev:frontend` run the halves separately.
- `npm run build` builds the frontend (`tsc -b && vite build`). **Run this after
  changes — it's the type-check + build gate.** There is no test suite.

## Architecture

Full-stack monorepo, no shared package.

### `/backend` — Express Gemini gateway
- `app.js` holds all routes and is shared by two entry points: `server.js`
  (local, listens on :3001) and `../api/index.js` (the Vercel serverless function).
  `personasStore.js` is the team-persona storage layer (see
  [Deployment & team library storage](#deployment--team-library-storage)).
- Reads the designer's Gemini key from the **`x-gemini-api-key` request header**
  on every call; never persists it. The frontend holds the key in
  `sessionStorage` only.
- `POST /api/simulate-step` — builds a persona system prompt + per-step user
  prompt, attaches the screenshot as a Gemini `inlineData` Part, asks for
  strict-JSON output (`responseMimeType: application/json`), then normalizes /
  clamps the result. `POST /api/validate-key` and `GET /api/health` also exist.
- `sanitizeError()` maps Gemini failures (bad key, quota, missing model) to
  friendly messages. Errors are returned as `{ error }` with a 4xx/502.

### `/frontend` — Vite + React + TS + Tailwind, shadcn-style UI
Three-column workspace (`who → what → results`), collapsible to a full-width
results view.

```
src/
  App.tsx              top-level state + layout. Owns personas, flow, saved
                       flows, run history, settings, batch/compare/expand state.
  components/
    SettingsPanel.tsx  Gemini key + model (dialog, key kept out of main UI);
                       exports SettingsDialog, GatewayStatusChip, GEMINI_MODELS
    PersonaPanel.tsx   persona roster (select/edit/delete/reset) + trait sliders
    PersonaEditor.tsx  create/edit persona dialog (incl. accent-color picker)
    DesignCanvas.tsx   flow steps + screenshot slots + flow library (templates
                       + saved flows). Paste / bulk-drop / drag-reorder live here
    SimulatorFeed.tsx  live per-step feed (eyes / monologue / action). Demo CTA
    ReportDashboard.tsx Recharts: frustration curve, efficiency bars, SUS card,
                       UX issue list (+ copy-as-markdown)
    RunHistory.tsx     archived runs; view / export / delete / select-to-compare
    RunComparison.tsx  2–4 runs overlaid: SUS deltas, curves, issue diff
    ui/                shadcn primitives (button, dialog, select, alert-dialog,
                       dropdown-menu, slider, tabs, …)
  hooks/
    useSimulation.ts   THE agent loop. start() / startBatch() / abort() / clear().
                       Streams StepResults into state; archives via onRunFinished
    useLocalStorage.ts small prefs (theme, model, mockMode, persona selection…)
    useIdbState.ts     image-heavy state via IndexedDB (steps, savedFlows,
                       runHistory) — avoids localStorage's ~5MB cap
  lib/
    api.ts             fetch wrapper for the backend (adds the key header)
    personas.ts        3 built-in blueprints, PERSONA_COLORS, factory/blank helpers
    templates.ts       pre-baked "Workflow Alpha/Beta" Casting Networks flows
    mockEngine.ts      offline sandbox: matches step text against persona pain
                       points to synthesize monologue/frustration/abandonment
    metrics.ts         SUS math, frustration curve, efficiency, abandon detection
    reportExport.ts    builds the single-file standalone HTML report (Tailwind
                       CDN + vanilla-JS charts); downloadStandaloneReport()
    idb.ts             tiny promise wrapper over IndexedDB (one kv store)
  types.ts             shared types: Persona, FlowStep, StepResult, SimulationRun,
                       SavedFlow, AppConfig
```

## Key concepts & non-obvious decisions

- **Sandbox vs. live.** `mockMode` (default ON) runs `mockEngine.ts` entirely in
  the browser — no key, no backend round-trip. Turning it off requires a Gemini
  key. Keep both paths working when touching the run loop.
- **The run loop is in `useSimulation.ts`.** It runs steps sequentially, carries
  frustration forward, and ends early on an `abandon` action. `startBatch()`
  reuses it across personas, tagging each run with `batch: {index,total}`.
  Finished runs (`done`/`aborted`, not `error`) fire `onRunFinished`, which
  App appends to `runHistory` (capped at 50).
- **Persistence split is deliberate.** Anything that can carry base64
  screenshots (`steps`, `savedFlows`, `runHistory`) uses `useIdbState`
  (IndexedDB). Small scalar prefs use `useLocalStorage`. `useIdbState` also
  one-time-migrates a legacy localStorage value if present.
- **Config portability.** Header Save/Load Config serializes `AppConfig`
  (personas + saved flows + current canvas + settings) to JSON. Keep new
  persisted fields in `AppConfig` and the import/export in `App.tsx` in sync.
- **The standalone report (`reportExport.ts`) is a string-built HTML document.**
  It must stay self-contained (Tailwind via CDN, vanilla JS, data embedded as
  JSON, `</script>` escaped). Don't import app code into it.
- **Persona color** flows from `personas.ts`/editor through feed, history rows,
  and comparison chart lines. New persona-facing UI should respect `color`.
- **Efficiency metric honesty:** abandoned runs report `attempted/planned steps`
  and mark the attrition step — don't revert this to a plain step count.

## Deployment & team library storage

### Vercel deploys
- Vercel project **`castinsight`** (linked in `.vercel/project.json`), deployed via
  the GitHub integration on `vincenttran-ts/cast-insight`.
- Push to **`master` → production** at https://castinsight.vercel.app. Any other
  branch gets a preview deployment, which is behind Vercel Authentication.
- `vercel.json` builds the frontend into `frontend/dist` and routes `/api/*` to the
  single function `api/index.js` (`maxDuration: 300`).
- Environment variables only apply to deployments built **after** they're set.
  After changing one, redeploy (push, or `npx vercel redeploy`).

### Where team personas live
`backend/personasStore.js` picks the backend per request:

| Environment | `BLOB_READ_WRITE_TOKEN` | Storage used |
|---|---|---|
| Vercel (prod/preview) | set | Vercel Blob — `castinsight/team-personas.json` |
| Vercel (prod/preview) | **missing** | none: routes return **503** `STORAGE_NOT_CONFIGURED` with setup steps |
| Local dev | not loaded (default) | `backend/data/team-personas.json` (gitignored, per-machine) |

- On Vercel there is **no local-file fallback**: the filesystem is read-only and
  `backend/data/` isn't deployed. Don't reintroduce writes or `mkdir` on the read
  path — that's what made the library 500 in production.
- The persona routes (`GET/POST /api/personas`, `PUT/DELETE /api/personas/:id`)
  share `sendPersonaStorageError()` in `app.js`, which logs the full error and
  returns the reason to the UI.

### The Blob store
- Store **`castinsight-team-library`** (`store_oOWagrGOSGxmxUx7`), region `iad1`,
  **public access**, connected to production, preview, and development.
- It **must be public**: writes use `put(..., { access: 'public' })` and reads
  `fetch()` the blob URL with no auth. A private store fails both (reads surface
  as a 401/403 "store is probably private" error).
- **Production and preview share the one store.** A persona saved from a preview
  deployment shows up in production immediately.
- The token also lives in `.env.local` (written by the Vercel CLI). `.env*` is
  gitignored — never commit it. `server.js` does **not** load `.env.local`, so
  local dev keeps using the per-machine file unless you opt in:

  ```bash
  set -a && . ./.env.local && set +a && npm run dev   # local dev against Blob
  ```

  That reads and writes the **shared production store** — use with care.

### Recreating or checking the store (Vercel CLI, via npx)

```bash
npx vercel whoami                      # must be the castinsight team account
npx vercel blob list-stores --all      # stores on the team + which project uses them
npx vercel env ls                      # expect BLOB_READ_WRITE_TOKEN in all 3 envs

# Create + link a public store (adds the token to all envs, writes .env.local):
npx vercel blob create-store castinsight-team-library --access public --region iad1 --yes
# then redeploy so production picks up the token
```

Verify production: `curl https://castinsight.vercel.app/api/personas` should
return `200` with `{ "personas": [...] }`. A `503` means the token is missing
from the deployment; a `500` includes the underlying Blob error.

To copy a machine's local personas into an **empty** store (no-op if it already
has personas):

```bash
set -a && . ./.env.local && set +a && VERCEL=1 node -e "
const s=require('./backend/personasStore.js');(async()=>{
const local=JSON.parse(require('fs').readFileSync('backend/data/team-personas.json','utf8')).personas;
if((await s.readTeamPersonas()).length) return console.log('store not empty — skipped');
await s.writeTeamPersonas(local);console.log('uploaded',local.length)})()"
```

## Conventions

- TypeScript strict; path alias `@/` → `src/`.
- Icons: **lucide-react only** (never hand-rolled SVG paths).
- UI: shadcn-style components in `components/ui/`; style with Tailwind + the CSS
  variables in `index.css` (light/dark via `.dark` on `<html>`).
- Use design-system `AlertDialog` for confirms — no `window.confirm/alert`.
- After meaningful changes, run `npm run build --prefix frontend` to type-check.

## Gotchas

- Three separate `package.json`s — install in each (root, backend, frontend).
- The frontend proxies `/api` → `http://localhost:3001` (see `vite.config.ts`),
  so the backend must be running for live (non-mock) simulations.
- Gemini model ids live in `GEMINI_MODELS` (SettingsPanel) but `model` is a free
  string end-to-end, so a custom model id flows through untouched.
- **Only offer models that work with new AI Studio keys.** Since 2026, keys
  start with `AQ.`, older `AIza` keys are rejected, and Gemini 2.5 and older are
  closed to new keys. The dropdown is `gemini-3.8-flash` (default) and
  `gemini-3.5-flash-lite`. The backend's `resolveModel()` and the frontend's
  `isRetiredModel()` move retired ids to the default — keep them in sync when the
  lineup changes.
