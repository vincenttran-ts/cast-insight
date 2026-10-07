/**
 * Team persona persistence — Vercel Blob in production, local JSON file in dev.
 */

const fs = require('fs');
const path = require('path');

const BLOB_PATH = 'castinsight/team-personas.json';
const LOCAL_PATH = path.join(__dirname, 'data', 'team-personas.json');

// Vercel functions run on a read-only filesystem and don't ship backend/data
// (it's gitignored), so the local-file fallback only exists in local dev.
const ON_VERCEL = Boolean(process.env.VERCEL);

/** Thrown when production has no Blob store to keep the team library in. */
class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      'Team library storage isn\'t configured for this deployment. Connect a public Vercel Blob store ' +
        'to the project (Vercel → Storage), which sets BLOB_READ_WRITE_TOKEN, then redeploy.'
    );
    this.name = 'StorageNotConfiguredError';
    this.code = 'STORAGE_NOT_CONFIGURED';
  }
}

const COGNITIVE_AXES = new Set(['analytical', 'divergent', 'systemic', 'risk_averse']);
const INFO_PREFS = new Set(['raw_data', 'narrative']);

const AXIS_LABELS = {
  analytical: 'Analytical',
  divergent: 'Divergent',
  systemic: 'Systemic',
  risk_averse: 'Risk-averse',
};

const INFO_LABELS = {
  raw_data: 'Raw data (bits & bobs)',
  narrative: 'High-level narrative',
};

function ensureLocalDir() {
  const dir = path.dirname(LOCAL_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function readFromBlob() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;

  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: BLOB_PATH, limit: 1, token });
  const match = blobs.find((b) => b.pathname === BLOB_PATH);
  if (!match) return [];

  const res = await fetch(match.url);
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Blob read was refused (${res.status}). The Blob store is probably private — the team library ` +
        'needs a public store.'
    );
  }
  if (!res.ok) throw new Error(`Blob read failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data.personas) ? data.personas : [];
}

async function writeToBlob(personas) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return false;

  const { put } = await import('@vercel/blob');
  await put(BLOB_PATH, JSON.stringify({ personas, updatedAt: new Date().toISOString() }), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
    contentType: 'application/json',
  });
  return true;
}

function readLocal() {
  // No mkdir here: reading must never write (the folder is created on first save).
  if (!fs.existsSync(LOCAL_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf8'));
    return Array.isArray(data.personas) ? data.personas : [];
  } catch {
    return [];
  }
}

function writeLocal(personas) {
  ensureLocalDir();
  fs.writeFileSync(
    LOCAL_PATH,
    JSON.stringify({ personas, updatedAt: new Date().toISOString() }, null, 2),
    'utf8'
  );
}

async function readTeamPersonas() {
  try {
    const blob = await readFromBlob();
    if (blob !== null) return blob;
  } catch (err) {
    // On Vercel there's no local file to fall back to — surface the real cause.
    if (ON_VERCEL) throw err;
    console.warn('[personas] Blob read failed, falling back to local file:', err.message || err);
  }
  if (ON_VERCEL) throw new StorageNotConfiguredError();
  return readLocal();
}

async function writeTeamPersonas(personas) {
  const wrote = await writeToBlob(personas);
  if (wrote) return;
  if (ON_VERCEL) throw new StorageNotConfiguredError();
  writeLocal(personas);
}

function splitToBullets(text) {
  if (!String(text || '').trim()) return [];
  return String(text)
    .split(/\n|[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeRoleLabel(role) {
  return String(role || '').trim().replace(/^The\s+/i, '').toLowerCase();
}

function archetypeLooksLikeRole(archetype, role) {
  const a = String(archetype || '').trim().toLowerCase();
  if (!a || !String(role || '').trim()) return false;
  const stripped = normalizeRoleLabel(role);
  return a === stripped || a === String(role).trim().toLowerCase();
}

function clampVisual(value, fallback = 50) {
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

function inferCognitiveAxis(archetype, mindsetBullets) {
  const text = `${archetype} ${(mindsetBullets || []).join(' ')}`.toLowerCase();
  if (/panic|deadline|risk|confirm|trust|literal|anxious|fee|ambiguous/.test(text)) return 'risk_averse';
  if (/dream|story|aspir|immers|vision|tone|atmospher|explor|scan|compare/.test(text)) return 'divergent';
  if (/learn|context|model|system|orient|tooltip|jargon/.test(text)) return 'systemic';
  return 'analytical';
}

function inferInfoPreference(mindsetBullets) {
  const text = (mindsetBullets || []).join(' ').toLowerCase();
  if (/data|status|percent|receipt|timestamp|label|indicator|explicit|confirm|raw/.test(text)) return 'raw_data';
  if (/story|narrative|context|meaning|purpose|reassur/.test(text)) return 'narrative';
  return 'raw_data';
}

function splitTriggers(text) {
  return String(text || '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function dedupeCap(items, cap = 12) {
  return [...new Set((items || []).map((s) => String(s).trim()).filter(Boolean))].slice(0, cap);
}

/**
 * Consolidated frustrationTriggers: prefer an explicit non-empty array; else
 * concatenate legacy painPoints, thinkingStyle.fluidityTriggers, and
 * walkthroughBehavior.quitTriggers.
 */
function buildFrustrationTriggers(persona) {
  if (Array.isArray(persona.frustrationTriggers) && persona.frustrationTriggers.some((t) => String(t).trim())) {
    return dedupeCap(persona.frustrationTriggers);
  }
  const merged = [
    ...(Array.isArray(persona.painPoints) ? persona.painPoints.map((p) => String(p)) : []),
    ...splitTriggers(persona.thinkingStyle?.fluidityTriggers),
    ...splitTriggers(persona.walkthroughBehavior?.quitTriggers),
  ];
  return dedupeCap(merged);
}

/**
 * Consolidated judgmentRules: prefer an explicit non-empty string; else compose
 * Always/Never/Watch-for lines from legacy mentalRules and uiEvaluationLens.
 */
function buildJudgmentRules(persona) {
  if (typeof persona.judgmentRules === 'string' && persona.judgmentRules.trim()) {
    return persona.judgmentRules.trim();
  }
  const rules = persona.thinkingStyle?.mentalRules || {};
  const always = String(rules.always || '').trim();
  const never = String(rules.never || '').trim();
  const watch = String(persona.walkthroughBehavior?.uiEvaluationLens || '').trim();
  const lines = [];
  if (always) lines.push(`Always: ${always}`);
  if (never) lines.push(`Never: ${never}`);
  if (watch) lines.push(`Watch for: ${watch}`);
  return lines.join('\n');
}

function inferVisualContinuum(archetype, mindsetBullets) {
  const text = `${archetype} ${(mindsetBullets || []).join(' ')}`.toLowerCase();
  if (/mobile|deadline|panic|minimal|no-frill|technical|status|data/.test(text)) return 20;
  if (/dream|immers|majestic|story|visual|atmosphere/.test(text)) return 75;
  return 50;
}

function isThinkingStyleV3(style) {
  if (!style) return false;
  return (
    COGNITIVE_AXES.has(style.dominantCognitiveAxis) &&
    INFO_PREFS.has(style.informationProcessingPreference) &&
    typeof style.visualContinuumPreference === 'number'
  );
}

/** Cognitive-only thinking-style normalizer (archetype, mindset, axis, info, visual). */
function normalizeThinkingStyleV3(style) {
  const archetype = String(style?.archetype || '').trim();
  const mindsetBullets = Array.isArray(style?.mindsetBullets)
    ? style.mindsetBullets.map((b) => String(b).trim()).filter(Boolean)
    : [];

  const dominantCognitiveAxis = COGNITIVE_AXES.has(style?.dominantCognitiveAxis)
    ? style.dominantCognitiveAxis
    : inferCognitiveAxis(archetype, mindsetBullets);

  const informationProcessingPreference = INFO_PREFS.has(style?.informationProcessingPreference)
    ? style.informationProcessingPreference
    : inferInfoPreference(mindsetBullets);

  const visualContinuumPreference =
    typeof style?.visualContinuumPreference === 'number'
      ? clampVisual(style.visualContinuumPreference, inferVisualContinuum(archetype, mindsetBullets))
      : inferVisualContinuum(archetype, mindsetBullets);

  return {
    archetype,
    mindsetBullets,
    dominantCognitiveAxis,
    informationProcessingPreference,
    visualContinuumPreference,
  };
}

function isPersonaV2(persona) {
  const legacyStyle = persona.thinkingStyle || {};
  if (String(legacyStyle.whyTheyCare || '').trim() || String(legacyStyle.optimizingFor || '').trim()) {
    return false;
  }

  const archetype = String(persona.thinkingStyle?.archetype || '').trim();
  const mindset = persona.thinkingStyle?.mindsetBullets || [];
  const hasMindset = Array.isArray(mindset) && mindset.some((b) => String(b).trim());

  return (
    persona.userProfile &&
    archetype.length > 0 &&
    hasMindset &&
    !archetypeLooksLikeRole(archetype, persona.role)
  );
}

function deriveArchetype(persona, legacyStyle) {
  let archetype = String(legacyStyle.archetype || persona.thinkingStyle?.archetype || '').trim();
  if (archetype && !archetypeLooksLikeRole(archetype, persona.role)) return archetype;

  const why = String(legacyStyle.whyTheyCare || '').trim();
  if (why) {
    const words = why.split(/\s+/).slice(0, 3).join(' ');
    const label = words.length > 28 ? 'Working Actor' : words.replace(/[.!?]$/, '');
    if (!archetypeLooksLikeRole(label, persona.role)) return label;
  }

  return 'Working Actor';
}

function migratePersonaV2(persona) {
  if (isPersonaV2(persona)) {
    return normalizeStoredPersona(persona);
  }

  const legacyStyle = persona.thinkingStyle || {};
  const name = String(persona.name || 'Unnamed').trim();
  const identityBullets = [];

  if (String(persona.role || '').trim()) identityBullets.push(String(persona.role).trim());
  if (String(persona.description || '').trim()) identityBullets.push(...splitToBullets(persona.description));
  if (String(persona.deviceContext || '').trim()) identityBullets.push(String(persona.deviceContext).trim());
  if (Array.isArray(persona.userProfile?.identityBullets)) {
    identityBullets.push(...persona.userProfile.identityBullets.filter(Boolean));
  }

  const mindsetBullets = [
    ...(legacyStyle.mindsetBullets || []),
    ...splitToBullets(legacyStyle.whyTheyCare),
    ...splitToBullets(legacyStyle.optimizingFor),
  ].filter(Boolean);

  const archetype = deriveArchetype(persona, legacyStyle);

  // Merge v1 thinking-style legacy fields into the shapes the builders read.
  const walkthroughBehavior = {
    quitTriggers: String(persona.walkthroughBehavior?.quitTriggers || legacyStyle.quitTriggers || '').trim(),
    uiEvaluationLens: String(
      persona.walkthroughBehavior?.uiEvaluationLens || legacyStyle.uiEvaluationLens || ''
    ).trim(),
  };

  return normalizeStoredPersona({
    ...persona,
    userProfile: {
      headline: String(persona.userProfile?.headline || '').trim() || `Meet ${name}`,
      identityBullets: [...new Set(identityBullets.map((b) => b.trim()).filter(Boolean))],
    },
    thinkingStyle: {
      archetype,
      mindsetBullets: [...new Set(mindsetBullets.map((b) => b.trim()).filter(Boolean))],
      dominantCognitiveAxis: legacyStyle.dominantCognitiveAxis,
      informationProcessingPreference: legacyStyle.informationProcessingPreference,
      visualContinuumPreference: legacyStyle.visualContinuumPreference,
      mentalRules: legacyStyle.mentalRules,
      fluidityTriggers: legacyStyle.fluidityTriggers,
    },
    walkthroughBehavior,
  });
}

function validatePersonaPayload(persona) {
  if (!persona || typeof persona !== 'object') return 'Persona body is required.';
  if (!String(persona.role || '').trim()) return 'Persona title is required.';

  const migrated = migratePersonaV2(persona);
  const style = migrated.thinkingStyle || {};
  const profile = migrated.userProfile || {};

  if (!String(style.archetype || '').trim()) return 'Thinking style: archetype is required.';
  if (archetypeLooksLikeRole(style.archetype, migrated.role)) {
    return 'Thinking style archetype must describe why they care, not their job title.';
  }
  const mindset = Array.isArray(style.mindsetBullets)
    ? style.mindsetBullets.map((b) => String(b).trim()).filter(Boolean)
    : [];
  if (mindset.length < 2) return 'Thinking style: at least two mindset bullets are required.';

  if (!COGNITIVE_AXES.has(style.dominantCognitiveAxis)) return 'Thinking style: cognitive axis is required.';
  if (!INFO_PREFS.has(style.informationProcessingPreference)) {
    return 'Thinking style: information processing preference is required.';
  }

  const identity = Array.isArray(profile.identityBullets)
    ? profile.identityBullets.map((b) => String(b).trim()).filter(Boolean)
    : [];
  if (identity.length < 2) return 'User persona: at least two identity bullets are required.';

  const triggers = Array.isArray(migrated.frustrationTriggers)
    ? migrated.frustrationTriggers.filter((t) => String(t).trim())
    : [];
  if (triggers.length === 0) return 'At least one frustration / quit trigger is required.';

  // judgmentRules is optional.
  const size = JSON.stringify(persona).length;
  if (size > 50000) return 'Persona payload is too large (max ~50KB).';
  return null;
}

/**
 * Finalizes a persona into the stored shape. Reads legacy fields via the
 * builders (so a legacy payload still upgrades) and outputs only the new shape.
 * Does not call migratePersonaV2 to avoid mutual recursion.
 */
function normalizeStoredPersona(persona) {
  const traits = persona.traits || {};
  const name = String(persona.name || 'Unnamed').trim();

  // Synthesize a walkthroughBehavior so the builders can read v1 quit/eval fields
  // that lived inside thinkingStyle in the oldest personas.
  const forBuilders = {
    ...persona,
    walkthroughBehavior: {
      quitTriggers: String(
        persona.walkthroughBehavior?.quitTriggers || persona.thinkingStyle?.quitTriggers || ''
      ).trim(),
      uiEvaluationLens: String(
        persona.walkthroughBehavior?.uiEvaluationLens || persona.thinkingStyle?.uiEvaluationLens || ''
      ).trim(),
    },
  };

  const thinkingStyle = normalizeThinkingStyleV3(persona.thinkingStyle || {});

  return {
    id: String(persona.id),
    name,
    role: String(persona.role || '').trim(),
    frustrationTriggers: buildFrustrationTriggers(forBuilders).slice(0, 12),
    judgmentRules: buildJudgmentRules(forBuilders),
    userProfile: {
      headline: String(persona.userProfile?.headline || '').trim() || `Meet ${name}`,
      identityBullets: Array.isArray(persona.userProfile?.identityBullets)
        ? persona.userProfile.identityBullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 12)
        : [],
    },
    thinkingStyle: {
      ...thinkingStyle,
      mindsetBullets: thinkingStyle.mindsetBullets.slice(0, 8),
    },
    traits: {
      techLiteracy: clampTrait(traits.techLiteracy, 50),
      frustrationThreshold: clampTrait(traits.frustrationThreshold, 50),
      industryExperience: clampTrait(traits.industryExperience, 50),
    },
    custom: persona.custom !== false,
    color: persona.color || undefined,
    shared: true,
    authorName: persona.authorName ? String(persona.authorName).trim() : undefined,
    updatedAt: new Date().toISOString(),
  };
}

function clampTrait(value, fallback) {
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

module.exports = {
  StorageNotConfiguredError,
  readTeamPersonas,
  writeTeamPersonas,
  validatePersonaPayload,
  normalizeStoredPersona,
  migratePersonaV2,
  AXIS_LABELS,
  INFO_LABELS,
};
