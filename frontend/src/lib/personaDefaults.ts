import type {
  CognitiveAxis,
  InformationProcessingPreference,
  MentalRules,
  Persona,
  PersonaTraits,
  ThinkingStyle,
  UserProfile,
  WalkthroughBehavior,
} from '@/types'
import { COGNITIVE_AXIS_OPTIONS, INFO_PREFERENCE_OPTIONS } from '@/lib/thinkingStylePresets'

export const REMOVED_BUILTIN_IDS = ['talent-rep', 'casting-director']

const COGNITIVE_AXES = new Set<CognitiveAxis>(['analytical', 'divergent', 'systemic', 'risk_averse'])
const INFO_PREFS = new Set<InformationProcessingPreference>(['raw_data', 'narrative'])

/** Legacy v1 thinking style shape (pre NASA-style cards). */
interface LegacyThinkingStyle {
  whyTheyCare?: string
  optimizingFor?: string
  quitTriggers?: string
  uiEvaluationLens?: string
  archetype?: string
  mindsetBullets?: string[]
  dominantCognitiveAxis?: CognitiveAxis
  informationProcessingPreference?: InformationProcessingPreference
  visualContinuumPreference?: number
  mentalRules?: Partial<MentalRules>
  fluidityTriggers?: string
}

export function emptyThinkingStyle(): ThinkingStyle {
  return {
    archetype: '',
    mindsetBullets: [],
    dominantCognitiveAxis: 'analytical',
    informationProcessingPreference: 'raw_data',
    visualContinuumPreference: 50,
  }
}

export function emptyUserProfile(): UserProfile {
  return { headline: '', identityBullets: [] }
}

export function emptyTraits(): PersonaTraits {
  return { techLiteracy: 50, frustrationThreshold: 50, industryExperience: 50 }
}

export function cognitiveAxisLabel(axis: CognitiveAxis): string {
  return COGNITIVE_AXIS_OPTIONS.find((o) => o.value === axis)?.label ?? axis
}

export function infoPreferenceLabel(pref: InformationProcessingPreference): string {
  return INFO_PREFERENCE_OPTIONS.find((o) => o.value === pref)?.label ?? pref
}

function splitToBullets(text: string): string[] {
  if (!text.trim()) return []
  return text
    .split(/\n|[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function splitTriggers(text: unknown): string[] {
  return String(text ?? '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function dedupeCap(items: string[], cap = 12): string[] {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))].slice(0, cap)
}

/**
 * Builds the consolidated frustrationTriggers array. Prefers an explicit
 * non-empty frustrationTriggers array; otherwise concatenates legacy
 * painPoints, thinkingStyle.fluidityTriggers, and walkthroughBehavior.quitTriggers.
 */
export function buildFrustrationTriggers(raw: Partial<Persona>): string[] {
  if (Array.isArray(raw.frustrationTriggers) && raw.frustrationTriggers.some((t) => String(t).trim())) {
    return dedupeCap(raw.frustrationTriggers.map((t) => String(t)))
  }
  const legacyStyle = raw.thinkingStyle as (Partial<ThinkingStyle> & LegacyThinkingStyle) | undefined
  const merged = [
    ...(Array.isArray(raw.painPoints) ? raw.painPoints.map((p) => String(p)) : []),
    ...splitTriggers(legacyStyle?.fluidityTriggers),
    ...splitTriggers(raw.walkthroughBehavior?.quitTriggers),
  ]
  return dedupeCap(merged)
}

/**
 * Builds the consolidated judgmentRules string. Prefers an explicit non-empty
 * judgmentRules; otherwise composes Always/Never/Watch-for lines from legacy
 * mentalRules and walkthroughBehavior.uiEvaluationLens. May be ''.
 */
export function buildJudgmentRules(raw: Partial<Persona>): string {
  if (typeof raw.judgmentRules === 'string' && raw.judgmentRules.trim()) {
    return raw.judgmentRules.trim()
  }
  const rules = raw.thinkingStyle?.mentalRules
  const always = String(rules?.always ?? '').trim()
  const never = String(rules?.never ?? '').trim()
  const watch = String(raw.walkthroughBehavior?.uiEvaluationLens ?? '').trim()
  const lines: string[] = []
  if (always) lines.push(`Always: ${always}`)
  if (never) lines.push(`Never: ${never}`)
  if (watch) lines.push(`Watch for: ${watch}`)
  return lines.join('\n')
}

function clampVisual(value: unknown, fallback = 50): number {
  const n = Math.round(Number(value))
  if (Number.isNaN(n)) return fallback
  return Math.min(100, Math.max(0, n))
}

function normalizeRoleLabel(role: string): string {
  return role.trim().replace(/^The\s+/i, '').toLowerCase()
}

export function archetypeLooksLikeRole(archetype: string, role: string): boolean {
  const a = archetype.trim().toLowerCase()
  if (!a || !role.trim()) return false
  const stripped = normalizeRoleLabel(role)
  return a === stripped || a === role.trim().toLowerCase()
}

function inferCognitiveAxis(archetype: string, mindsetBullets: string[]): CognitiveAxis {
  const text = `${archetype} ${mindsetBullets.join(' ')}`.toLowerCase()
  if (/panic|deadline|risk|confirm|trust|literal|anxious|fee|ambiguous/.test(text)) return 'risk_averse'
  if (/dream|story|aspir|immers|vision|tone|atmospher/.test(text)) return 'divergent'
  if (/explor|scan|compare|alternativ|back-track|broad/.test(text)) return 'divergent'
  if (/learn|context|model|system|orient|tooltip|jargon/.test(text)) return 'systemic'
  return 'analytical'
}

function inferInfoPreference(mindsetBullets: string[]): InformationProcessingPreference {
  const text = mindsetBullets.join(' ').toLowerCase()
  if (/data|status|percent|receipt|timestamp|label|indicator|explicit|confirm|raw/.test(text)) {
    return 'raw_data'
  }
  if (/story|narrative|context|meaning|purpose|reassur/.test(text)) return 'narrative'
  return 'raw_data'
}

function inferVisualContinuum(archetype: string, mindsetBullets: string[]): number {
  const text = `${archetype} ${mindsetBullets.join(' ')}`.toLowerCase()
  if (/mobile|deadline|panic|minimal|no-frill|technical|status|data/.test(text)) return 20
  if (/dream|immers|majestic|story|visual|atmosphere/.test(text)) return 75
  return 50
}

/** Cognitive-only thinking-style normalizer (archetype, mindset, axis, info, visual). */
function normalizeThinkingStyleV3(style: Partial<ThinkingStyle>): ThinkingStyle {
  const archetype = style.archetype?.trim() || ''
  const mindsetBullets = Array.isArray(style.mindsetBullets)
    ? style.mindsetBullets.map((b) => String(b).trim()).filter(Boolean)
    : []

  const dominantCognitiveAxis = COGNITIVE_AXES.has(style.dominantCognitiveAxis as CognitiveAxis)
    ? (style.dominantCognitiveAxis as CognitiveAxis)
    : inferCognitiveAxis(archetype, mindsetBullets)

  const informationProcessingPreference = INFO_PREFS.has(
    style.informationProcessingPreference as InformationProcessingPreference
  )
    ? (style.informationProcessingPreference as InformationProcessingPreference)
    : inferInfoPreference(mindsetBullets)

  const visualContinuumPreference =
    typeof style.visualContinuumPreference === 'number'
      ? clampVisual(style.visualContinuumPreference, inferVisualContinuum(archetype, mindsetBullets))
      : inferVisualContinuum(archetype, mindsetBullets)

  return {
    archetype,
    mindsetBullets,
    dominantCognitiveAxis,
    informationProcessingPreference,
    visualContinuumPreference,
  }
}

function isPersonaV2(raw: Partial<Persona>): boolean {
  const legacyStyle = raw.thinkingStyle as LegacyThinkingStyle | undefined
  if (legacyStyle?.whyTheyCare?.trim() || legacyStyle?.optimizingFor?.trim()) return false

  const archetype = raw.thinkingStyle?.archetype?.trim() ?? ''
  const mindset = raw.thinkingStyle?.mindsetBullets ?? []
  const hasMindset = Array.isArray(mindset) && mindset.some((b) => String(b).trim())

  return (
    Boolean(raw.userProfile) &&
    archetype.length > 0 &&
    hasMindset &&
    !archetypeLooksLikeRole(archetype, raw.role ?? '')
  )
}

function deriveArchetype(raw: Partial<Persona>, legacy?: LegacyThinkingStyle): string {
  const existing = legacy?.archetype?.trim() || raw.thinkingStyle?.archetype?.trim() || ''
  if (existing && !archetypeLooksLikeRole(existing, raw.role ?? '')) return existing

  const why = legacy?.whyTheyCare?.trim() || ''
  if (why.length > 0) {
    const words = why.split(/\s+/).slice(0, 3).join(' ')
    const label = words.length > 28 ? 'Working Actor' : words.replace(/[.!?]$/, '')
    if (!archetypeLooksLikeRole(label, raw.role ?? '')) return label
  }

  return 'Working Actor'
}

/** Migrate legacy persona shapes to the consolidated schema. */
export function migratePersonaV2(raw: Partial<Persona> & { id: string }): Persona {
  if (isPersonaV2(raw)) {
    return normalizePersonaFields(raw)
  }

  const legacyStyle = (raw.thinkingStyle ?? {}) as LegacyThinkingStyle
  const name = raw.name?.trim() || 'Unnamed'
  const identityBullets: string[] = []

  if (raw.role?.trim()) identityBullets.push(raw.role.trim())
  if (raw.description?.trim()) identityBullets.push(...splitToBullets(raw.description))
  if (raw.deviceContext?.trim()) identityBullets.push(raw.deviceContext.trim())
  if (Array.isArray(raw.userProfile?.identityBullets)) {
    identityBullets.push(...raw.userProfile.identityBullets.filter(Boolean))
  }

  const mindsetBullets = [
    ...(legacyStyle.mindsetBullets ?? []),
    ...splitToBullets(legacyStyle.whyTheyCare ?? ''),
    ...splitToBullets(legacyStyle.optimizingFor ?? ''),
  ].filter(Boolean)

  const dedupedIdentity = [...new Set(identityBullets.map((b) => b.trim()).filter(Boolean))]
  const dedupedMindset = [...new Set(mindsetBullets.map((b) => b.trim()).filter(Boolean))]

  // Merge v1 thinking-style legacy fields into the shapes the builders read.
  const walkthroughBehavior: WalkthroughBehavior = {
    quitTriggers: raw.walkthroughBehavior?.quitTriggers?.trim() || legacyStyle.quitTriggers?.trim() || '',
    uiEvaluationLens:
      raw.walkthroughBehavior?.uiEvaluationLens?.trim() || legacyStyle.uiEvaluationLens?.trim() || '',
  }

  return normalizePersonaFields({
    ...raw,
    userProfile: {
      headline: raw.userProfile?.headline?.trim() || `Meet ${name}`,
      identityBullets: dedupedIdentity,
    },
    thinkingStyle: {
      archetype: deriveArchetype(raw, legacyStyle),
      mindsetBullets: dedupedMindset,
      dominantCognitiveAxis: legacyStyle.dominantCognitiveAxis,
      informationProcessingPreference: legacyStyle.informationProcessingPreference,
      visualContinuumPreference: legacyStyle.visualContinuumPreference,
      mentalRules: legacyStyle.mentalRules
        ? { always: legacyStyle.mentalRules.always ?? '', never: legacyStyle.mentalRules.never ?? '' }
        : undefined,
      fluidityTriggers: legacyStyle.fluidityTriggers,
    },
    walkthroughBehavior,
  } as Partial<Persona> & { id: string })
}

/** Re-normalize a persona to the consolidated schema (reads legacy fields too). */
export function migratePersonaV3(persona: Partial<Persona> & { id: string }): Persona {
  return normalizePersonaFields(persona)
}

function normalizePersonaFields(raw: Partial<Persona> & { id: string }): Persona {
  const name = raw.name?.trim() || 'Unnamed'

  const userProfile: UserProfile = {
    headline: raw.userProfile?.headline?.trim() || `Meet ${name}`,
    identityBullets: Array.isArray(raw.userProfile?.identityBullets)
      ? raw.userProfile.identityBullets.map((b) => String(b).trim()).filter(Boolean)
      : [],
  }

  const thinkingStyle = normalizeThinkingStyleV3({
    archetype: raw.thinkingStyle?.archetype?.trim() || '',
    mindsetBullets: Array.isArray(raw.thinkingStyle?.mindsetBullets)
      ? raw.thinkingStyle.mindsetBullets.map((b) => String(b).trim()).filter(Boolean)
      : [],
    dominantCognitiveAxis: raw.thinkingStyle?.dominantCognitiveAxis,
    informationProcessingPreference: raw.thinkingStyle?.informationProcessingPreference,
    visualContinuumPreference: raw.thinkingStyle?.visualContinuumPreference,
  })

  return {
    id: raw.id,
    name,
    role: raw.role?.trim() || 'Untitled persona',
    frustrationTriggers: buildFrustrationTriggers(raw),
    judgmentRules: buildJudgmentRules(raw),
    userProfile,
    thinkingStyle,
    traits: { ...(raw.traits ?? emptyTraits()) },
    custom: raw.custom,
    color: raw.color,
    shared: raw.shared,
    authorName: raw.authorName,
    updatedAt: raw.updatedAt,
  }
}

export function normalizePersona(raw: Partial<Persona> & { id: string }): Persona {
  return migratePersonaV2(raw)
}

export function thinkingStyleHeadline(persona: Persona): string {
  const archetype = persona.thinkingStyle.archetype.trim()
  return archetype ? `${persona.name} is a ${archetype}` : persona.name
}

export function userProfileHeadline(persona: Persona): string {
  return persona.userProfile.headline.trim() || `Meet ${persona.name}`
}

export function personaContextText(persona: Persona): string {
  const style = persona.thinkingStyle
  return [
    style.archetype,
    ...style.mindsetBullets,
    persona.judgmentRules,
    persona.frustrationTriggers.join(' '),
    cognitiveAxisLabel(style.dominantCognitiveAxis),
    ...persona.userProfile.identityBullets,
  ]
    .filter(Boolean)
    .join(' ')
}

function readLegacyTraits(): PersonaTraits | undefined {
  try {
    const raw = localStorage.getItem('castinsight.traits')
    if (!raw) return undefined
    localStorage.removeItem('castinsight.traits')
    return JSON.parse(raw) as PersonaTraits
  } catch {
    return undefined
  }
}

function readStoredPersonaId(): string | undefined {
  try {
    const raw = localStorage.getItem('castinsight.personaId')
    return raw ? (JSON.parse(raw) as string) : undefined
  } catch {
    return undefined
  }
}

function applyBuiltinBlueprint(stored: Persona, blueprint: Persona): Persona {
  return {
    ...stored,
    name: blueprint.name,
    role: blueprint.role,
    userProfile: {
      headline: blueprint.userProfile.headline,
      identityBullets: [...blueprint.userProfile.identityBullets],
    },
    thinkingStyle: {
      ...blueprint.thinkingStyle,
      mindsetBullets: [...blueprint.thinkingStyle.mindsetBullets],
    },
    frustrationTriggers: [...blueprint.frustrationTriggers],
    judgmentRules: blueprint.judgmentRules,
    color: stored.color ?? blueprint.color,
  }
}

export function reviveStoredPersonas(raw: unknown, fallback: Persona[]): Persona[] {
  if (!Array.isArray(raw)) return fallback
  return migratePersonasList(raw, readLegacyTraits(), readStoredPersonaId(), fallback)
}

export function loadPersonasFromStorage(fallback: Persona[]): Persona[] {
  try {
    const raw = localStorage.getItem('castinsight.personas')
    if (!raw) return fallback
    return reviveStoredPersonas(JSON.parse(raw), fallback)
  } catch {
    return fallback
  }
}

export function migratePersonasList(
  list: Partial<Persona>[],
  legacyTraits?: PersonaTraits,
  selectedPersonaId?: string,
  blueprints: Persona[] = []
): Persona[] {
  const blueprintById = new Map(blueprints.filter((p) => !p.custom).map((p) => [p.id, p]))
  const filtered = list.filter((p) => p.id && !REMOVED_BUILTIN_IDS.includes(p.id))
  let normalized = filtered.map((p) => migratePersonaV2(p as Persona & { id: string }))

  normalized = normalized.map((p) => {
    const blueprint = blueprintById.get(p.id)
    if (blueprint && !p.custom) return applyBuiltinBlueprint(p, blueprint)
    return p
  })

  if (legacyTraits && selectedPersonaId) {
    return normalized.map((p) =>
      p.id === selectedPersonaId ? { ...p, traits: { ...legacyTraits } } : p
    )
  }
  return normalized
}

export function isPersonaComplete(persona: Persona): boolean {
  const style = persona.thinkingStyle
  const archetype = style.archetype.trim()
  return (
    persona.role.trim().length > 0 &&
    archetype.length > 0 &&
    !archetypeLooksLikeRole(archetype, persona.role) &&
    style.mindsetBullets.filter((b) => b.trim()).length >= 2 &&
    COGNITIVE_AXES.has(style.dominantCognitiveAxis) &&
    INFO_PREFS.has(style.informationProcessingPreference) &&
    persona.userProfile.identityBullets.filter((b) => b.trim()).length >= 2 &&
    persona.frustrationTriggers.filter((t) => t.trim()).length >= 1
  )
}

export type PersonaEditorTab = 'character' | 'reactions' | 'calibration'

export const PERSONA_EDITOR_TABS: PersonaEditorTab[] = ['character', 'reactions', 'calibration']

export function personaTabComplete(persona: Persona, tab: PersonaEditorTab): boolean {
  const style = persona.thinkingStyle
  switch (tab) {
    case 'character':
      return (
        persona.role.trim().length > 0 &&
        persona.userProfile.identityBullets.filter((b) => b.trim()).length >= 2 &&
        style.archetype.trim().length > 0 &&
        !archetypeLooksLikeRole(style.archetype, persona.role) &&
        style.mindsetBullets.filter((b) => b.trim()).length >= 2
      )
    case 'reactions':
      return persona.frustrationTriggers.filter((t) => t.trim()).length >= 1
    case 'calibration':
      return true
  }
}

export function personaCompletenessPercent(persona: Persona): number {
  const done = PERSONA_EDITOR_TABS.filter((t) => personaTabComplete(persona, t)).length
  return Math.round((done / PERSONA_EDITOR_TABS.length) * 100)
}

export function clonePersonaDraft(persona: Persona): Persona {
  return {
    ...persona,
    traits: { ...persona.traits },
    frustrationTriggers: [...persona.frustrationTriggers],
    userProfile: {
      ...persona.userProfile,
      identityBullets: [...persona.userProfile.identityBullets],
    },
    thinkingStyle: {
      ...persona.thinkingStyle,
      mindsetBullets: [...persona.thinkingStyle.mindsetBullets],
    },
  }
}

export function normalizePersonaForSave(draft: Persona): Persona {
  const name = draft.name.trim() || 'Unnamed'
  return normalizePersona({
    ...draft,
    role: draft.role.trim(),
    name,
    frustrationTriggers: draft.frustrationTriggers.map((t) => t.trim()).filter(Boolean),
    judgmentRules: draft.judgmentRules.trim(),
    userProfile: {
      headline: draft.userProfile.headline.trim() || `Meet ${name}`,
      identityBullets: draft.userProfile.identityBullets.map((b) => b.trim()).filter(Boolean),
    },
    thinkingStyle: {
      archetype: draft.thinkingStyle.archetype.trim(),
      mindsetBullets: draft.thinkingStyle.mindsetBullets.map((b) => b.trim()).filter(Boolean),
      dominantCognitiveAxis: draft.thinkingStyle.dominantCognitiveAxis,
      informationProcessingPreference: draft.thinkingStyle.informationProcessingPreference,
      visualContinuumPreference: draft.thinkingStyle.visualContinuumPreference,
    },
  })
}

export function forkPersona(source: Persona): Persona {
  return normalizePersona({
    ...source,
    id: `custom-${Date.now()}`,
    name: source.name ? `${source.name} (copy)` : 'Unnamed copy',
    custom: true,
    shared: false,
    authorName: undefined,
    updatedAt: undefined,
  })
}
