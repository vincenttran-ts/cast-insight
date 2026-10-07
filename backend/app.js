/**
 * CastInsight Express app — shared between local server.js and Vercel api/index.js.
 */

const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const {
  readTeamPersonas,
  writeTeamPersonas,
  validatePersonaPayload,
  normalizeStoredPersona,
  migratePersonaV2,
} = require('./personasStore');

const app = express();
const JSON_LIMIT = process.env.VERCEL ? '4mb' : '50mb';

app.use(cors({ origin: true, allowedHeaders: ['Content-Type', 'x-gemini-api-key'] }));
app.use(express.json({ limit: JSON_LIMIT }));

/* ------------------------------------------------------------------ */
/* Gemini model + key handling                                          */
/* ------------------------------------------------------------------ */

// Recommended stable default for new AI Studio keys (Oct 2026).
const DEFAULT_MODEL = 'gemini-3.8-flash';

// Gemini 1.x/2.0 are shut down; 2.5 is restricted to projects that already used
// it (since 2026-09-18) and retires 2026-10-20. New keys live in new projects,
// so these ids fail for them — route them to the current default instead.
const RETIRED_MODEL = /^gemini-(1\.|2\.0|2\.5)/i;

function resolveModel(model) {
  const id = String(model || '').trim();
  if (!id || RETIRED_MODEL.test(id)) return DEFAULT_MODEL;
  return id;
}

/** Keys pasted from AI Studio often carry stray whitespace/newlines. */
function readApiKey(req) {
  const raw = req.headers['x-gemini-api-key'];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Gemini 3+ is tuned for the default temperature (1.0); Google warns lower
 * values can cause looping or degraded reasoning. Only older/custom pre-3
 * model ids get an explicit temperature.
 */
function samplingConfig(model, temperature) {
  return /^gemini-([3-9]|\d{2,})/i.test(model) ? {} : { temperature };
}

function buildSystemPrompt(persona) {
  const migrated = migratePersonaV2(persona);
  const traits = migrated.traits || {};
  const style = migrated.thinkingStyle || {};
  const profile = migrated.userProfile || {};
  const headline = profile.headline || `Meet ${migrated.name}`;
  const frustrationTriggers = Array.isArray(migrated.frustrationTriggers) ? migrated.frustrationTriggers : [];
  const mindset = (style.mindsetBullets || []).map((b) => `- ${b}`).join('\n');
  const identity = (profile.identityBullets || []).map((b) => `- ${b}`).join('\n');
  const axisLabel = {
    analytical: 'Analytical',
    divergent: 'Divergent',
    systemic: 'Systemic',
    risk_averse: 'Risk-averse',
  }[style.dominantCognitiveAxis] || style.dominantCognitiveAxis || 'Analytical';
  const infoLabel =
    style.informationProcessingPreference === 'narrative'
      ? 'High-level narrative'
      : 'Raw data (bits & bobs, status labels, counts)';
  const visual = style.visualContinuumPreference ?? 50;

  return `You are a synthetic user-testing agent performing a cognitive walkthrough of the Casting Networks web application (an entertainment-industry casting platform).

You must fully embody this persona and never break character:

PERSONA: ${migrated.name} (${migrated.role})

USER PERSONA:
- Headline: ${headline}
- Identity:
${identity || '- Not specified'}

THINKING STYLE — ${migrated.name} is a ${style.archetype || 'Working Actor'}:
- Cognitive axis: ${axisLabel}
- Information preference: ${infoLabel}
- Visual preference: Technical/No-Frills ←→ Majestic/Immersive (${visual}/100)
- Mindset:
${mindset || '- Not specified'}

FRUSTRATION & QUIT TRIGGERS:
${frustrationTriggers.length ? frustrationTriggers.map((t) => `- ${t}`).join('\n') : '- Not specified'}

HOW THEY JUDGE THE UI:
${migrated.judgmentRules || 'Not specified'}

TRAIT CALIBRATION (0-100 scales):
- Tech Literacy: ${traits.techLiteracy ?? 50}/100 (low = struggles with non-obvious affordances, jargon, and hidden states)
- Frustration Threshold: ${traits.frustrationThreshold ?? 50}/100 (low = confusion converts to frustration very quickly)
- Industry Experience: ${traits.industryExperience ?? 50}/100 (low = unfamiliar with casting workflow conventions like self-tapes, sides, breakdowns, media tokens)

Evaluate each step through this cognitive lens:
1. Ground the inner monologue in the cognitive axis first — how this persona processes ambiguity and risk.
2. Judge UI copy and layout using their information preference (missing raw data vs missing narrative orientation).
3. Critique visual density using their visual continuum preference (too ornamental vs too sparse).
4. Apply their "how they judge the UI" rules explicitly in the monologue when relevant.
5. Abandon or back-track when the screen hits their frustration & quit triggers.

You will be shown ONE step of a user flow at a time (a text description of the intended step, optionally with a staging-environment UI screenshot). Evaluate it strictly through this persona's eyes: what they notice first, what confuses them, what they would actually do — including wrong turns, hesitation, backtracking, or abandoning the task entirely if frustration exceeds their threshold.

EVALUATION SCOPE (staging environment — always apply):
- Screenshots are from a staging environment: UI chrome, layout, and interaction patterns are real and must be evaluated. Field values in tables, forms, and lists are often seed/test data and must NOT drive frustration scores or uxIssues.
- DO evaluate: information architecture, primary action clarity, hierarchy, affordances, empty/loading/error states, confirmation feedback, destructive-action placement, mobile tap targets, workflow continuity, and persona-specific quit triggers applied to interaction patterns (e.g. ambiguous upload state), not sample row content.
- DO NOT evaluate: seed names, fake emails, sample audition titles, placeholder dates, lorem text, staging-only labels, unrealistic numeric values in table cells, or typos in mock rows — unless the field type itself is the design problem (e.g. a required field with no label, not "John Doe is a weird name").
- Seed-data oddities must NOT increase frustration unless they obscure UI state (e.g. unreadable truncated label).

GROUNDING (critical for accuracy):
- First observe ONLY what is literally present. If a screenshot is attached, inventory UI structure: regions, components, controls, states, navigation, and system/control labels. When noting text, distinguish control labels and system copy (design-relevant) from row/cell values (usually seed data — mention briefly, do not critique).
- If no screenshot is attached, say so and reason from the step description alone.
- Never invent UI elements, labels, or states that are not visible. If something needed is not present, treat its absence as the finding.
- Your monologue, action, and scores must reference only elements listed in "observedElements", focusing on interaction patterns not seed data values.

FRUSTRATION SCALE (1-100, calibrate to this persona's Frustration Threshold — a low threshold means confusion converts to frustration faster):
- 1-20: smooth, confident, no friction
- 21-40: minor hesitation, quickly resolved
- 41-60: notable confusion, has to work to proceed
- 61-80: significant friction, considering backtracking
- 81-100: blocked or distrustful, about to abandon

CONFIDENCE SCALE (1-100): 1-20 lost / no idea if on the right path; 41-60 unsure but proceeding; 81-100 certain they are on the right path.

SUCCESS: judge "succeeded" against the step's SUCCESS CRITERIA when provided in the user message; otherwise against the stated step intent. Do not mark succeeded=true if the persona abandons or backtracks without accomplishing the step.

Respond with ONLY a JSON object matching exactly this shape (no markdown fences, no commentary). Fields must appear in this order so observation precedes judgment:
{
  "observedElements": "objective inventory of UI structure (regions, components, controls, states, CTAs, system/control labels) actually visible this step; note seed row values briefly without critiquing them, or 'No screenshot provided — reasoning from the step description.' when no image is attached",
  "innerMonologue": "2-4 sentences of first-person stream-of-consciousness from the persona, referencing interaction patterns and elements named in observedElements — not seed data values",
  "action": "short label of the concrete action taken, e.g. CLICK 'Submit Self-Tape', SCROLL down hunting for status, HESITATE on pricing token, BACK-TRACK to previous screen, ABANDON task",
  "actionType": "one of: click | type | scroll | hesitate | backtrack | abandon | complete",
  "confidence": <integer 1-100, per the CONFIDENCE SCALE above>,
  "frustration": <integer 1-100, per the FRUSTRATION SCALE above>,
  "simulatedStepsTaken": <integer 1-4, how many real interactions (a click, a scroll, a field edit) the persona needed for this one intended step (1 = optimal, more = fumbling/looping)>,
  "uxIssues": [{"scope": "structure|interaction|feedback|accessibility|content", "issue": "actionable product-design recommendation a designer can act on without changing staging seed scripts"}, "..."],
  "succeeded": <boolean, did the persona accomplish this step per SUCCESS CRITERIA / intent>
}`;
}

function buildStepPrompt(
  step,
  stepIndex,
  totalSteps,
  taskGoal,
  priorContext,
  expectedOutcome,
  hasImage,
  evaluationBrief,
  designNotes
) {
  const history = priorContext && priorContext.length
    ? `\nWHAT HAPPENED ON PREVIOUS STEPS:\n${priorContext
        .map((h, i) => `Step ${i + 1}: action="${h.action}", frustration=${h.frustration}, succeeded=${h.succeeded}`)
        .join('\n')}`
    : '';
  const criteria = expectedOutcome && String(expectedOutcome).trim()
    ? `\nSUCCESS CRITERIA for this step (judge "succeeded" against this): ${String(expectedOutcome).trim()}`
    : '';
  const brief = evaluationBrief && String(evaluationBrief).trim()
    ? `\nEVALUATION FOCUS (designer-provided): ${String(evaluationBrief).trim()}`
    : '';
  const notes = designNotes && String(designNotes).trim()
    ? `\nDESIGN NOTES for this step: ${String(designNotes).trim()}`
    : '';
  const imageLine = hasImage
    ? 'ENVIRONMENT: Staging screenshot — evaluate UI/UX and interaction design; treat table/form cell values as non-authoritative seed data unless the step goal explicitly tests that data. Inventory UI structure before you judge.'
    : 'No image is attached for this step. State that in observedElements and evaluate from the step description alone; lower your confidence accordingly and do not invent visual details.';
  return `OVERALL TASK GOAL: ${taskGoal}${brief}
${history}

CURRENT STEP ${stepIndex + 1} of ${totalSteps} (the designer's intended action): "${step}"${criteria}${notes}

${imageLine}

Carry forward accumulated frustration from previous steps. Output the JSON object only.`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'castinsight-backend', time: new Date().toISOString() });
});

/**
 * Shared error reply for the team-library routes: log the full error, return
 * 503 + setup guidance when storage isn't configured, otherwise a 500 that
 * still says what went wrong.
 */
function sendPersonaStorageError(res, label, fallback, err) {
  console.error(`[personas ${label}]`, err?.stack || err?.message || err);
  if (err?.code === 'STORAGE_NOT_CONFIGURED') {
    return res.status(503).json({ error: err.message, code: err.code });
  }
  const reason = String(err?.message || err || '').slice(0, 200);
  res.status(500).json({ error: reason ? `${fallback} (${reason})` : fallback });
}

app.get('/api/personas', async (_req, res) => {
  try {
    const personas = await readTeamPersonas();
    res.json({ personas });
  } catch (err) {
    sendPersonaStorageError(res, 'GET', 'Failed to load team personas.', err);
  }
});

app.post('/api/personas', async (req, res) => {
  try {
    const raw = req.body?.persona;
    const errMsg = validatePersonaPayload(raw);
    if (errMsg) return res.status(400).json({ error: errMsg });

    const persona = normalizeStoredPersona(raw);
    const list = await readTeamPersonas();
    const idx = list.findIndex((p) => p.id === persona.id);
    if (idx >= 0) list[idx] = persona;
    else list.push(persona);
    await writeTeamPersonas(list);
    res.json({ persona });
  } catch (err) {
    sendPersonaStorageError(res, 'POST', 'Failed to save persona to team library.', err);
  }
});

app.put('/api/personas/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const raw = req.body?.persona;
    if (!raw || String(raw.id) !== id) {
      return res.status(400).json({ error: 'Persona id mismatch.' });
    }
    const errMsg = validatePersonaPayload(raw);
    if (errMsg) return res.status(400).json({ error: errMsg });

    const persona = normalizeStoredPersona(raw);
    const list = await readTeamPersonas();
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Persona not found in team library.' });
    list[idx] = persona;
    await writeTeamPersonas(list);
    res.json({ persona });
  } catch (err) {
    sendPersonaStorageError(res, 'PUT', 'Failed to update persona.', err);
  }
});

app.delete('/api/personas/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const list = await readTeamPersonas();
    const next = list.filter((p) => p.id !== id);
    if (next.length === list.length) return res.status(404).json({ error: 'Persona not found.' });
    await writeTeamPersonas(next);
    res.json({ ok: true });
  } catch (err) {
    sendPersonaStorageError(res, 'DELETE', 'Failed to delete persona.', err);
  }
});

app.post('/api/validate-key', async (req, res) => {
  const apiKey = readApiKey(req);
  if (!apiKey) return res.status(401).json({ ok: false, error: 'Missing x-gemini-api-key header' });
  const model = resolveModel(req.body?.model);
  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model,
      contents: 'Reply with the single word: ok',
    });
    res.json({ ok: true, model, sample: (result.text || '').slice(0, 40) });
  } catch (err) {
    res.status(400).json({ ok: false, model, error: sanitizeError(err, model, apiKey) });
  }
});

app.post('/api/simulate-step', async (req, res) => {
  const apiKey = readApiKey(req);
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-gemini-api-key header. Add your Google AI Studio key in Settings.' });
  }

  const {
    model,
    persona,
    step,
    stepIndex,
    totalSteps,
    taskGoal,
    priorContext,
    image,
    expectedOutcome,
    evaluationBrief,
    designNotes,
    temperature,
  } = req.body || {};
  if (!persona || !step) {
    return res.status(400).json({ error: 'Request must include `persona` and `step`.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const hasImage = Boolean(image && image.data);
    const parts = [{
      text: buildStepPrompt(
        step,
        stepIndex ?? 0,
        totalSteps ?? 1,
        taskGoal || step,
        priorContext,
        expectedOutcome,
        hasImage,
        evaluationBrief,
        designNotes
      ),
    }];
    if (hasImage) {
      parts.push({
        inlineData: {
          data: stripDataUrlPrefix(image.data),
          mimeType: image.mimeType || 'image/png',
        },
      });
    }

    // Pre-Gemini-3 models: lower temperature keeps the scored fields (frustration,
    // confidence, succeeded) stable across runs; callers may override within [0, 1].
    // Gemini 3+ ignores this and runs at its default (see samplingConfig).
    const temp = Number.isFinite(temperature)
      ? Math.min(1, Math.max(0, Number(temperature)))
      : 0.5;
    const resolvedModel = resolveModel(model);

    const result = await ai.models.generateContent({
      model: resolvedModel,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: buildSystemPrompt(persona),
        responseMimeType: 'application/json',
        ...samplingConfig(resolvedModel, temp),
      },
    });

    const raw = result.text || '';
    const parsed = extractJson(raw);
    if (!parsed) {
      return res.status(502).json({ error: 'Gemini returned unparseable output', raw: raw.slice(0, 2000) });
    }
    res.json(normalizeStepResult(parsed));
  } catch (err) {
    console.error('[simulate-step]', err.message || err);
    res.status(502).json({ error: sanitizeError(err, resolveModel(model), apiKey) });
  }
});

function buildGeneratePersonaPrompt(who, task, constraints) {
  const extra = constraints && String(constraints).trim()
    ? `\nCONSTRAINTS: ${String(constraints).trim()}`
    : '';
  return `WHO: ${who}

TASK ON CASTING NETWORKS: ${task}${extra}

Generate a synthetic user persona for cognitive walkthrough testing of the Casting Networks platform (entertainment casting: self-tapes, breakdowns, sides, media tokens, submissions).

Output ONLY a JSON object with these fields:
{
  "name": "display name",
  "role": "persona title e.g. The Talent / Actor (not the archetype)",
  "userProfile": {
    "headline": "Meet {name}",
    "identityBullets": ["2-4 bullets about who they are"]
  },
  "thinkingStyle": {
    "archetype": "cognitive label e.g. Panic Submitter — MUST NOT duplicate the role title",
    "mindsetBullets": ["2-4 bullets on how they think"],
    "dominantCognitiveAxis": "analytical | divergent | systemic | risk_averse",
    "informationProcessingPreference": "raw_data | narrative",
    "visualContinuumPreference": <integer 0-100, technical vs immersive>
  },
  "frustrationTriggers": ["3-6 interaction-pattern triggers, not seed data complaints"],
  "judgmentRules": "Always: ...\\nNever: ...\\nWatch for: ...",
  "traits": {
    "techLiteracy": <integer 0-100>,
    "frustrationThreshold": <integer 0-100>,
    "industryExperience": <integer 0-100>
  }
}`;
}

const COGNITIVE_AXES_GEN = new Set(['analytical', 'divergent', 'systemic', 'risk_averse']);
const INFO_PREFS_GEN = new Set(['raw_data', 'narrative']);
const PERSONA_COLORS_GEN = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

function clampTraitGen(value, fallback) {
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

function normalizeGeneratedPersona(raw, who, task) {
  const name = String(raw.name || 'Generated Persona').trim().slice(0, 80);
  const role = String(raw.role || 'Casting Platform User').trim().slice(0, 120);
  const style = raw.thinkingStyle || {};
  const profile = raw.userProfile || {};
  const traits = raw.traits || {};

  const identityBullets = Array.isArray(profile.identityBullets)
    ? profile.identityBullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 6)
    : [];
  if (identityBullets.length < 2) {
    identityBullets.push(
      String(who).trim().slice(0, 200) || 'Casting platform user',
      String(task).trim().slice(0, 200) || 'Completing a workflow on Casting Networks'
    );
  }

  const mindsetBullets = Array.isArray(style.mindsetBullets)
    ? style.mindsetBullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 6)
    : [];
  if (mindsetBullets.length < 2) {
    mindsetBullets.push(
      'Needs explicit confirmation before trusting irreversible platform actions',
      'Judges UI by whether the task outcome is verifiable on-screen'
    );
  }

  const frustrationTriggers = Array.isArray(raw.frustrationTriggers)
    ? raw.frustrationTriggers.map((t) => String(t).trim()).filter(Boolean).slice(0, 8)
    : ['Ambiguous system states with no clear next step'];

  return migratePersonaV2({
    id: `custom-${Date.now()}`,
    name,
    role,
    userProfile: {
      headline: String(profile.headline || '').trim() || `Meet ${name}`,
      identityBullets,
    },
    thinkingStyle: {
      archetype: String(style.archetype || 'Working Actor').trim().slice(0, 80),
      mindsetBullets,
      dominantCognitiveAxis: COGNITIVE_AXES_GEN.has(style.dominantCognitiveAxis)
        ? style.dominantCognitiveAxis
        : 'analytical',
      informationProcessingPreference: INFO_PREFS_GEN.has(style.informationProcessingPreference)
        ? style.informationProcessingPreference
        : 'raw_data',
      visualContinuumPreference: clampTraitGen(style.visualContinuumPreference, 50),
    },
    frustrationTriggers,
    judgmentRules: String(raw.judgmentRules || '').trim(),
    traits: {
      techLiteracy: clampTraitGen(traits.techLiteracy, 50),
      frustrationThreshold: clampTraitGen(traits.frustrationThreshold, 50),
      industryExperience: clampTraitGen(traits.industryExperience, 50),
    },
    custom: true,
    color: PERSONA_COLORS_GEN[Math.abs(name.length + role.length) % PERSONA_COLORS_GEN.length],
  });
}

app.post('/api/generate-persona', async (req, res) => {
  const apiKey = readApiKey(req);
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-gemini-api-key header. Add your Google AI Studio key in Settings.' });
  }

  const { who, task, constraints } = req.body || {};
  const model = resolveModel(req.body?.model);
  if (!String(who || '').trim() || !String(task || '').trim()) {
    return res.status(400).json({ error: 'Request must include `who` and `task`.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model,
      contents: buildGeneratePersonaPrompt(who, task, constraints),
      config: {
        systemInstruction:
          'You create Casting Networks synthetic user personas for UX cognitive walkthroughs. Respond with JSON only. Archetype must describe cognitive style, not job title. Frustration triggers must be interaction patterns, not complaints about mock data.',
        responseMimeType: 'application/json',
        ...samplingConfig(model, 0.7),
      },
    });

    const raw = result.text || '';
    const parsed = extractJson(raw);
    if (!parsed) {
      return res.status(502).json({ error: 'Gemini returned unparseable persona JSON', raw: raw.slice(0, 2000) });
    }

    const persona = normalizeGeneratedPersona(parsed, who, task);
    res.json({ persona });
  } catch (err) {
    console.error('[generate-persona]', err.message || err);
    res.status(502).json({ error: sanitizeError(err, model, apiKey) });
  }
});

function stripDataUrlPrefix(data) {
  const idx = data.indexOf('base64,');
  return idx >= 0 ? data.slice(idx + 'base64,'.length) : data;
}

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const ACTION_TYPES = ['click', 'type', 'scroll', 'hesitate', 'backtrack', 'abandon', 'complete'];
const UX_ISSUE_SCOPES = new Set(['structure', 'interaction', 'feedback', 'accessibility', 'content']);

const SEED_DATA_ISSUE_PATTERN =
  /\b(lorem|ipsum|test user|sample data|placeholder|fake email|unprofessional|typo in|john doe|jane doe|mock data|seed data|test@|@example\.|dummy|foobar)\b/i;

function normalizeUxIssue(raw) {
  if (raw && typeof raw === 'object' && raw.issue != null) {
    const scope = UX_ISSUE_SCOPES.has(raw.scope) ? raw.scope : 'interaction';
    return { scope, issue: String(raw.issue).trim().slice(0, 500) };
  }
  const text = String(raw ?? '').trim().slice(0, 500);
  if (!text) return null;
  return { scope: 'interaction', issue: text };
}

function isSeedDataContentIssue(issue) {
  if (issue.scope !== 'content') return false;
  return SEED_DATA_ISSUE_PATTERN.test(issue.issue);
}

function normalizeUxIssues(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeUxIssue)
    .filter(Boolean)
    .filter((issue) => !isSeedDataContentIssue(issue))
    .slice(0, 6);
}

function normalizeStepResult(parsed) {
  return {
    observedElements: parsed.observedElements ? String(parsed.observedElements).slice(0, 1200) : undefined,
    innerMonologue: String(parsed.innerMonologue || 'No monologue generated.'),
    action: String(parsed.action || 'UNKNOWN action'),
    actionType: ACTION_TYPES.includes(parsed.actionType) ? parsed.actionType : 'hesitate',
    frustration: clampInt(parsed.frustration, 1, 100, 50),
    confidence: clampInt(parsed.confidence, 1, 100, 50),
    simulatedStepsTaken: clampInt(parsed.simulatedStepsTaken, 1, 4, 1),
    uxIssues: normalizeUxIssues(parsed.uxIssues),
    succeeded: Boolean(parsed.succeeded),
  };
}

/** Pull Google's own status + message out of an SDK error for diagnostics. */
function googleErrorDetail(err) {
  const msg = err?.message || String(err);
  let status = '';
  let detail = msg;
  const json = msg.match(/\{[\s\S]*\}/);
  if (json) {
    try {
      const body = JSON.parse(json[0]);
      const e = body.error || body;
      status = e.status || '';
      detail = e.message || detail;
    } catch {
      /* not JSON — keep the raw message */
    }
  }
  return { msg, status, detail: String(detail).slice(0, 220) };
}

/**
 * Map Gemini failures to designer-friendly guidance. Key problems and
 * model-access problems are kept distinct: a 403 for a model a new key's
 * project can't use is NOT a bad key, and saying so sends people in circles.
 */
function sanitizeError(err, model, apiKey = '') {
  const { msg, status, detail } = googleErrorDetail(err);
  const resolvedModel = model || DEFAULT_MODEL;
  const code = Number(err?.status) || Number((msg.match(/\b(4\d\d|5\d\d)\b/) || [])[1]) || 0;
  const isLegacyKey = /^AIza/.test(apiKey);
  const said = detail && detail !== msg.slice(0, 220) ? ` (Google: ${detail})` : ` (${detail})`;

  const authFailure =
    code === 401 ||
    code === 403 ||
    /UNAUTHENTICATED|PERMISSION_DENIED|api key not valid|api_key_invalid|api key expired/i.test(msg);

  // Checked first: an old key should always be told to make a new one.
  if (isLegacyKey && authFailure) {
    return (
      'This is an older "AIza" standard key, which the Gemini API stopped accepting in September 2026. ' +
      'Create a new key at https://aistudio.google.com/apikey — it will start with "AQ."'
    );
  }
  // Google returns this for any "AQ." string it can't verify (mistyped, cut
  // off when copying, deleted, or rotated) — not only for a wrong key type.
  if (/ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(msg)) {
    return (
      'Google doesn\'t recognize this "AQ." key. Re-copy the whole key from https://aistudio.google.com/apikey ' +
      '(it\'s easy to cut it off), or create a new one if it was deleted or rotated.'
    );
  }
  if (/api key not valid|api_key_invalid|api key expired|invalid api key/i.test(msg)) {
    return (
      'Google did not accept this API key. Re-copy it from https://aistudio.google.com/apikey ' +
      '(new keys start with "AQ.").'
    );
  }
  if (/quota|resource.?exhausted/i.test(msg) || code === 429) {
    return (
      `Gemini rate limit hit for ${resolvedModel}. Wait a minute, switch to gemini-3.5-flash-lite for lighter usage, ` +
      'use Sandbox Mode while iterating, or link billing for higher limits (https://aistudio.google.com/rate-limit).'
    );
  }
  if (code === 404 || /not.?found|is not supported|NOT_FOUND/i.test(msg)) {
    return (
      `Model "${resolvedModel}" isn't available to this key. Pick ${DEFAULT_MODEL} in Settings — ` +
      'Gemini 2.5 and older are closed to new keys.' + said
    );
  }
  if (code === 403 || /PERMISSION_DENIED|permission/i.test(msg)) {
    return (
      `This key's project isn't allowed to use "${resolvedModel}". Try ${DEFAULT_MODEL}; preview/Pro models ` +
      'may need billing enabled on the AI Studio project.' + said
    );
  }
  if (code === 401 || /UNAUTHENTICATED/i.test(msg) || status === 'UNAUTHENTICATED') {
    return 'Google could not authenticate this key. Re-copy it from https://aistudio.google.com/apikey.' + said;
  }
  return msg.slice(0, 300);
}

module.exports = app;
