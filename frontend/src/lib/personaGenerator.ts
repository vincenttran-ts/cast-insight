import { generatePersonaViaApi } from '@/lib/api'
import { clonePersonaDraft, normalizePersonaForSave } from '@/lib/personaDefaults'
import { PERSONA_COLORS, personaFromPreset } from '@/lib/personas'
import { THINKING_STYLE_PRESETS } from '@/lib/thinkingStylePresets'
import type { Persona, PersonaGenerateInput, PersonaTraits } from '@/types'

export type { PersonaGenerateInput } from '@/types'

export interface PersonaGenerateOptions {
  mockMode: boolean
  apiKey: string
  model: string
}

const SYNTHETIC_NAMES = [
  'Jordan Ellis',
  'Sam Rivera',
  'Alex Chen',
  'Morgan Blake',
  'Riley Santos',
  'Casey Nguyen',
  'Dana Reyes',
  'Marcus Webb',
]

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pickName(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return SYNTHETIC_NAMES[hash % SYNTHETIC_NAMES.length]
}

function splitBullets(text: string): string[] {
  return text
    .split(/[\n;]|(?:\.\s+)/)
    .map((s) => s.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean)
    .slice(0, 4)
}

function inferRole(who: string, task: string): string {
  const combined = `${who} ${task}`.toLowerCase()
  if (/casting director|cd\b|casting office/.test(combined)) return 'Casting Director'
  if (/rep\b|agent|manager|talent rep/.test(combined)) return 'Talent Rep / Manager'
  if (/producer|production/.test(combined)) return 'Production Coordinator'
  if (/actor|talent|performer|self-tape|audition/.test(combined)) return 'The Talent / Actor'
  return 'Casting Platform User'
}

function inferPresetId(who: string, task: string, constraints: string): string {
  const text = `${who} ${task} ${constraints}`.toLowerCase()
  if (/upload|deadline|mobile|panic|confirm|processing|self-tape submit/.test(text)) return 'panic-submitter'
  if (/brief|spec|compliance|wardrobe|slate format|commercial/.test(text)) return 'brief-purist'
  if (/compare|review|shortlist|filter|sort|analytical/.test(text)) return 'technical-gatekeeper'
  if (/volume|batch|many audition|grind|high throughput/.test(text)) return 'volume-grinder'
  if (/receipt|confirm|received|proof|verification/.test(text)) return 'receipt-hunter'
  if (/callback|wait|status|follow up|pending/.test(text)) return 'callback-waiter'
  if (/scene|story|character|dramatic|film|tv|episodic/.test(text)) return 'scene-first-actor'
  if (/spot|quick turn|same-day|commercial spot/.test(text)) return 'spot-ready-player'
  return 'panic-submitter'
}

function tuneTraits(constraints: string, base: PersonaTraits): PersonaTraits {
  const text = constraints.toLowerCase()
  let techLiteracy = base.techLiteracy
  let frustrationThreshold = base.frustrationThreshold
  let industryExperience = base.industryExperience

  if (/low tech|anxious|struggle|non-technical|mobile-only/.test(text)) techLiteracy = Math.min(techLiteracy, 35)
  if (/power user|technical|savvy/.test(text)) techLiteracy = Math.max(techLiteracy, 70)
  if (/deadline|stress|panic|impatient|rage/.test(text)) frustrationThreshold = Math.min(frustrationThreshold, 35)
  if (/patient|calm|experienced/.test(text)) frustrationThreshold = Math.max(frustrationThreshold, 65)
  if (/veteran|years|experienced|industry/.test(text)) industryExperience = Math.max(industryExperience, 75)
  if (/new to casting|rookie|first time/.test(text)) industryExperience = Math.min(industryExperience, 40)

  return { techLiteracy, frustrationThreshold, industryExperience }
}

function taskFrustrationTriggers(task: string): string[] {
  const triggers: string[] = []
  const t = task.toLowerCase()
  if (/upload|self-tape|video|file/.test(t)) triggers.push('Ambiguous upload or processing states with no clear phase label')
  if (/confirm|received|submit|deadline/.test(t)) triggers.push('No receipt-style confirmation that casting received materials')
  if (/fee|token|premium|pay/.test(t)) triggers.push('Surprise fees or tokens revealed mid-flow')
  if (/crop|headshot|photo|media/.test(t)) triggers.push('Preview or crop tooling too small to trust on mobile')
  if (/review|compare|filter/.test(t)) triggers.push('Dense tables with no clear primary action or status hierarchy')
  if (triggers.length === 0) {
    triggers.push('Unclear next step after completing the intended action')
    triggers.push('Missing explicit feedback that the task succeeded')
  }
  return triggers.slice(0, 5)
}

function buildWatchFor(task: string): string {
  const t = task.trim()
  if (!t) return 'Does this screen make the next step and outcome obvious?'
  return `Does this screen support the goal: ${t.charAt(0).toLowerCase()}${t.slice(1).replace(/\.$/, '')}?`
}

/** Heuristic mock generator — no API required. */
export async function generatePersonaMock(input: PersonaGenerateInput): Promise<Persona> {
  await sleep(750 + Math.random() * 400)

  const who = input.who.trim()
  const task = input.task.trim()
  const constraints = (input.constraints ?? '').trim()
  const presetId = inferPresetId(who, task, constraints)
  const base = personaFromPreset(presetId)
  const preset = THINKING_STYLE_PRESETS.find((p) => p.id === presetId)

  const identityFromWho = splitBullets(who)
  const identityBullets =
    identityFromWho.length >= 2
      ? identityFromWho
      : [
          who.slice(0, 120) || 'Casting platform user',
          task.slice(0, 120) || 'Completing a workflow on Casting Networks',
        ]

  const role = inferRole(who, task)
  const name = pickName(`${who}${task}`)
  const mergedTriggers = [
    ...new Set([...(preset?.frustrationTriggers ?? base.frustrationTriggers), ...taskFrustrationTriggers(task)]),
  ].slice(0, 6)

  const judgmentRules =
    preset?.judgmentRules ||
    `Always: Verify screen state before committing to the next step\nNever: Assume silent success without explicit confirmation\nWatch for: ${buildWatchFor(task)}`

  const persona: Persona = {
    ...base,
    id: `custom-${Date.now()}`,
    name,
    role,
    userProfile: {
      headline: `Meet ${name}`,
      identityBullets,
    },
    thinkingStyle: {
      ...base.thinkingStyle,
      mindsetBullets: [
        ...base.thinkingStyle.mindsetBullets.slice(0, 2),
        task.length > 20 ? `Focused on: ${task.replace(/\.$/, '')}` : base.thinkingStyle.mindsetBullets[2] ?? '',
      ]
        .map((b) => b.trim())
        .filter(Boolean)
        .slice(0, 4),
    },
    frustrationTriggers: mergedTriggers,
    judgmentRules,
    traits: tuneTraits(constraints, base.traits),
    color: PERSONA_COLORS[Math.abs(who.length + task.length) % PERSONA_COLORS.length],
    custom: true,
  }

  if (persona.thinkingStyle.mindsetBullets.length < 2) {
    persona.thinkingStyle.mindsetBullets.push(
      'Needs the platform to reduce ambiguity at every irreversible step',
      'Judges UI by whether the outcome of this task is verifiable on-screen'
    )
  }

  return clonePersonaDraft(normalizePersonaForSave(persona))
}

export type PersonaGenerateSource = 'sandbox' | 'gemini'

/** Facade: Gemini when live, mock in sandbox or when key missing. */
export async function generatePersona(
  input: PersonaGenerateInput,
  options: PersonaGenerateOptions
): Promise<{ persona: Persona; source: PersonaGenerateSource }> {
  const { mockMode, apiKey, model } = options
  if (mockMode || !apiKey.trim()) {
    return { persona: await generatePersonaMock(input), source: 'sandbox' }
  }
  const persona = await generatePersonaViaApi(input, apiKey.trim(), model)
  return { persona, source: 'gemini' }
}
