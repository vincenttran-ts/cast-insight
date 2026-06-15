# CastInsight — Synthetic User Testing Simulator

Internal UX tool for the Casting Networks design team. Runs automated **cognitive walkthroughs** of user flows using AI agents configured with entertainment-industry personas (Talent/Actor, Talent Rep, Casting Director), powered by the **Google Gemini API**.

## Quick Start

```bash
npm install            # root (concurrently)
npm run dev            # starts backend (:3001) + frontend (:5173) together
```

Or run the halves separately:

```bash
npm run dev:backend    # Express Gemini gateway on http://localhost:3001
npm run dev:frontend   # Vite workspace on http://localhost:5173
```

Open http://localhost:5173. With no API key, flip on **Sandbox Mock Mode** in the Gemini API Gateway panel to run context-aware simulated walkthroughs immediately. For live multimodal evaluation, paste a [Google AI Studio](https://aistudio.google.com/) key — it is held in session memory only and forwarded per-request via the `x-gemini-api-key` header; the backend never stores it.

## Architecture

```
/backend          Node + Express
  server.js       CORS, key passthrough from request headers, Gemini SDK
                  (@google/genai), base64 screenshots → inlineData Parts,
                  structured-JSON persona evaluation per flow step
/frontend         Vite + React + TypeScript + Tailwind (shadcn-style UI)
  src/components/
    SettingsPanel.tsx    Gemini gateway: key, model dropdown
                         (gemini-2.5-flash / gemini-1.5-pro), mock toggle
    PersonaPanel.tsx     persona roster + trait sliders (Tech Literacy,
                         Frustration Threshold, Industry Experience)
    PersonaEditor.tsx    create/edit dialog for personas (built-ins are
                         editable too; factory reset keeps custom ones)
    DesignCanvas.tsx     ordered flow-step tracker + per-step screenshot
                         drop slots + pre-baked Workflow Alpha/Beta templates
    SimulatorFeed.tsx    live feed: The User's Eyes / Persona Inner
                         Monologue / Current Action Taken
    ReportDashboard.tsx  Recharts frustration curve, optimal-vs-simulated
                         efficiency bars, SUS metric card, UX issue register
  src/hooks/
    useSimulation.ts     sequential agent loop (live Gemini or mock engine)
    useLocalStorage.ts   quota-safe persisted state
  src/lib/
    personas.ts, templates.ts, mockEngine.ts, metrics.ts (SUS math),
    api.ts, reportExport.ts (standalone HTML report compiler)
```

## Key Features

- **Editable persona roster** — the 3 industry blueprints can be edited in place, and the team can add fully custom personas (title, background, device context, pain points, default traits). Custom personas persist locally, travel with config JSON exports, and the sandbox mock engine matches their stated pain points against flow steps for context-aware reactions.

- **Dual-input canvas** — text step sequence + sequential screenshot/wireframe uploads, combined per step into the Gemini multimodal payload.
- **Flow library** — save the current canvas as a named flow (steps and screenshots included) via the bookmark button; saved flows appear in the same dropdown as the built-in templates under "My Saved Flows", with overwrite-by-name protection and per-flow delete. The library persists locally and travels with config JSON exports.
- **Run AI Simulation** — clears the feed and walks the persona step-by-step; frustration carries across steps, and a persona can hesitate, back-track, or abandon mid-flow.
- **Analytics** — frustration curve (1–100 per step), optimal vs. AI-simulated step counts, and a synthesized SUS score with letter grading (`metrics.ts` documents the formula).
- **Export Standalone Interactive Report** — compiles the whole run (charts, feed log, issues, screenshots) into a single self-contained `castinsight-report.html` with Tailwind CDN + vanilla-JS interactivity. Double-click it anywhere — no server needed.
- **Config portability** — workspace state persists to localStorage; *Save Config / Load Config* round-trips the full setup as JSON.
