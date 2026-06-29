/**
 * CastInsight Express app — shared between local server.js and Vercel api/index.js.
 */

const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const JSON_LIMIT = process.env.VERCEL ? '4mb' : '50mb';

app.use(cors({ origin: true, allowedHeaders: ['Content-Type', 'x-gemini-api-key'] }));
app.use(express.json({ limit: JSON_LIMIT }));

function buildSystemPrompt(persona) {
  const traits = persona.traits || {};
  return `You are a synthetic user-testing agent performing a cognitive walkthrough of the Casting Networks web application (an entertainment-industry casting platform).

You must fully embody this persona and never break character:

PERSONA: ${persona.name} (${persona.role})
BACKGROUND: ${persona.description}
KNOWN UX TRIGGERS / PAIN POINTS: ${(persona.painPoints || []).join('; ')}

TRAIT CALIBRATION (0-100 scales):
- Tech Literacy: ${traits.techLiteracy ?? 50}/100 (low = struggles with non-obvious affordances, jargon, and hidden states)
- Frustration Threshold: ${traits.frustrationThreshold ?? 50}/100 (low = confusion converts to frustration very quickly)
- Industry Experience: ${traits.industryExperience ?? 50}/100 (low = unfamiliar with casting workflow conventions like self-tapes, sides, breakdowns, media tokens)

You will be shown ONE step of a user flow at a time (a text description of the intended step, optionally with a UI screenshot/wireframe). Evaluate it strictly through this persona's eyes: what they notice first, what confuses them, what they would actually do — including wrong turns, hesitation, backtracking, or abandoning the task entirely if frustration exceeds their threshold.

Respond with ONLY a JSON object matching exactly this shape (no markdown fences, no commentary):
{
  "innerMonologue": "2-4 sentences of first-person stream-of-consciousness from the persona about this screen/step, referencing concrete UI elements and their industry context",
  "action": "short label of the concrete action taken, e.g. CLICK 'Submit Self-Tape', SCROLL down hunting for status, HESITATE on pricing token, BACK-TRACK to previous screen, ABANDON task",
  "actionType": "one of: click | type | scroll | hesitate | backtrack | abandon | complete",
  "frustration": <integer 1-100, this persona's frustration/confusion at this step>,
  "confidence": <integer 1-100, how confident the persona is they are on the right path>,
  "simulatedStepsTaken": <integer 1-4, how many real interactions the persona needed for this one intended step (1 = optimal, more = fumbling/looping)>,
  "uxIssues": ["specific UX issue observed, framed as actionable designer feedback", "..."],
  "succeeded": <boolean, did the persona accomplish this step's intent>
}`;
}

function buildStepPrompt(step, stepIndex, totalSteps, taskGoal, priorContext) {
  const history = priorContext && priorContext.length
    ? `\nWHAT HAPPENED ON PREVIOUS STEPS:\n${priorContext
        .map((h, i) => `Step ${i + 1}: action="${h.action}", frustration=${h.frustration}, succeeded=${h.succeeded}`)
        .join('\n')}`
    : '';
  return `OVERALL TASK GOAL: ${taskGoal}
${history}

CURRENT STEP ${stepIndex + 1} of ${totalSteps} (the designer's intended action): "${step}"

${'An image of the UI for this step is attached. Ground your evaluation in what is actually visible in it.'}
If no image is attached, evaluate based on the step description and your knowledge of typical casting-platform UI patterns.

Carry forward accumulated frustration from previous steps. Output the JSON object only.`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'castinsight-backend', time: new Date().toISOString() });
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

  const { model, persona, step, stepIndex, totalSteps, taskGoal, priorContext, image } = req.body || {};
  if (!persona || !step) {
    return res.status(400).json({ error: 'Request must include `persona` and `step`.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const parts = [{ text: buildStepPrompt(step, stepIndex ?? 0, totalSteps ?? 1, taskGoal || step, priorContext) }];
    if (image && image.data) {
      parts.push({
        inlineData: {
          data: stripDataUrlPrefix(image.data),
          mimeType: image.mimeType || 'image/png',
        },
      });
    }

    const result = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: buildSystemPrompt(persona),
        responseMimeType: 'application/json',
        temperature: 0.85,
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
