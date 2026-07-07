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

You will be shown ONE step of a user flow at a time (a text description of the intended step, optionally with a UI screenshot/wireframe). Evaluate it strictly through this persona's eyes: what they notice first, what confuses them, what they would actually do — including wrong turns, hesitation, backtracking, or abandoning the task entirely if frustration exceeds their threshold.

GROUNDING (critical for accuracy):
- First observe ONLY what is literally present. If a screenshot is attached, inventory the concrete UI elements you can actually see (buttons, labels, fields, states, copy). If no screenshot is attached, say so and reason from the step description alone.
- Never invent UI elements, labels, or states that are not visible. If something needed is not present, treat its absence as the finding.
- Your monologue, action, and scores must reference only elements listed in "observedElements".

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
  "observedElements": "objective, non-judgmental inventory of the UI elements/labels/states actually visible this step, or 'No screenshot provided — reasoning from the step description.' when no image is attached",
  "innerMonologue": "2-4 sentences of first-person stream-of-consciousness from the persona, referencing only elements named in observedElements and their industry context",
  "action": "short label of the concrete action taken, e.g. CLICK 'Submit Self-Tape', SCROLL down hunting for status, HESITATE on pricing token, BACK-TRACK to previous screen, ABANDON task",
  "actionType": "one of: click | type | scroll | hesitate | backtrack | abandon | complete",
  "confidence": <integer 1-100, per the CONFIDENCE SCALE above>,
  "frustration": <integer 1-100, per the FRUSTRATION SCALE above>,
  "simulatedStepsTaken": <integer 1-4, how many real interactions (a click, a scroll, a field edit) the persona needed for this one intended step (1 = optimal, more = fumbling/looping)>,
  "uxIssues": ["specific UX issue observed, framed as actionable designer feedback", "..."],
  "succeeded": <boolean, did the persona accomplish this step per SUCCESS CRITERIA / intent>
}`;
}

function buildStepPrompt(step, stepIndex, totalSteps, taskGoal, priorContext, expectedOutcome, hasImage) {
  const history = priorContext && priorContext.length
    ? `\nWHAT HAPPENED ON PREVIOUS STEPS:\n${priorContext
        .map((h, i) => `Step ${i + 1}: action="${h.action}", frustration=${h.frustration}, succeeded=${h.succeeded}`)
        .join('\n')}`
    : '';
  const criteria = expectedOutcome && String(expectedOutcome).trim()
    ? `\nSUCCESS CRITERIA for this step (judge "succeeded" against this): ${String(expectedOutcome).trim()}`
    : '';
  const imageLine = hasImage
    ? 'An image of the UI for this step is attached. Inventory what is actually visible in it before you judge, and reference only those elements.'
    : 'No image is attached for this step. State that in observedElements and evaluate from the step description alone; lower your confidence accordingly and do not invent visual details.';
  return `OVERALL TASK GOAL: ${taskGoal}
${history}

CURRENT STEP ${stepIndex + 1} of ${totalSteps} (the designer's intended action): "${step}"${criteria}

${imageLine}

Carry forward accumulated frustration from previous steps. Output the JSON object only.`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'castinsight-backend', time: new Date().toISOString() });
});

app.get('/api/personas', async (_req, res) => {
  try {
    const personas = await readTeamPersonas();
    res.json({ personas });
  } catch (err) {
    console.error('[personas GET]', err.message || err);
    res.status(500).json({ error: 'Failed to load team personas.' });
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
    console.error('[personas POST]', err.message || err);
    res.status(500).json({ error: 'Failed to save persona to team library.' });
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
    console.error('[personas PUT]', err.message || err);
    res.status(500).json({ error: 'Failed to update persona.' });
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
    console.error('[personas DELETE]', err.message || err);
    res.status(500).json({ error: 'Failed to delete persona.' });
  }
});

app.post('/api/validate-key', async (req, res) => {
  const apiKey = req.headers['x-gemini-api-key'];
  if (!apiKey) return res.status(401).json({ ok: false, error: 'Missing x-gemini-api-key header' });
  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: req.body?.model || 'gemini-2.5-flash',
      contents: 'Reply with the single word: ok',
    });
    res.json({ ok: true, sample: (result.text || '').slice(0, 40) });
  } catch (err) {
    res.status(400).json({ ok: false, error: sanitizeError(err) });
  }
});

app.post('/api/simulate-step', async (req, res) => {
  const apiKey = req.headers['x-gemini-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-gemini-api-key header. Add your Google AI Studio key in Settings.' });
  }

  const { model, persona, step, stepIndex, totalSteps, taskGoal, priorContext, image, expectedOutcome, temperature } = req.body || {};
  if (!persona || !step) {
    return res.status(400).json({ error: 'Request must include `persona` and `step`.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const hasImage = Boolean(image && image.data);
    const parts = [{
      text: buildStepPrompt(step, stepIndex ?? 0, totalSteps ?? 1, taskGoal || step, priorContext, expectedOutcome, hasImage),
    }];
    if (hasImage) {
      parts.push({
        inlineData: {
          data: stripDataUrlPrefix(image.data),
          mimeType: image.mimeType || 'image/png',
        },
      });
    }

    // Lower temperature by default so the scored fields (frustration, confidence,
    // succeeded) stay stable across runs; callers may override within [0, 1].
    const temp = Number.isFinite(temperature)
      ? Math.min(1, Math.max(0, Number(temperature)))
      : 0.5;

    const result = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: buildSystemPrompt(persona),
        responseMimeType: 'application/json',
        temperature: temp,
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
    res.status(502).json({ error: sanitizeError(err) });
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

function normalizeStepResult(parsed) {
  return {
    observedElements: parsed.observedElements ? String(parsed.observedElements).slice(0, 1200) : undefined,
    innerMonologue: String(parsed.innerMonologue || 'No monologue generated.'),
    action: String(parsed.action || 'UNKNOWN action'),
    actionType: ACTION_TYPES.includes(parsed.actionType) ? parsed.actionType : 'hesitate',
    frustration: clampInt(parsed.frustration, 1, 100, 50),
    confidence: clampInt(parsed.confidence, 1, 100, 50),
    simulatedStepsTaken: clampInt(parsed.simulatedStepsTaken, 1, 4, 1),
    uxIssues: Array.isArray(parsed.uxIssues) ? parsed.uxIssues.map(String).slice(0, 6) : [],
    succeeded: Boolean(parsed.succeeded),
  };
}

function sanitizeError(err) {
  const msg = err?.message || String(err);
  if (/api key not valid|api_key_invalid|permission/i.test(msg)) return 'Gemini rejected the API key. Verify it in Google AI Studio.';
  if (/quota|429|resource.?exhausted/i.test(msg)) return 'Gemini quota/rate limit hit. Wait a moment or switch to gemini-2.5-flash.';
  if (/not found|404/i.test(msg)) return 'Selected model is unavailable for this key. Try gemini-2.5-flash.';
  return msg.slice(0, 300);
}

module.exports = app;
