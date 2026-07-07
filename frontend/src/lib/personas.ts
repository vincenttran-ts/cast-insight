import type { Persona } from '@/types'
import { getThinkingStylePreset } from '@/lib/thinkingStylePresets'

/**
 * Built-in entertainment-industry persona for Casting Networks cognitive walkthroughs.
 */
export const PERSONAS: Persona[] = [
  {
    id: 'talent-actor',
    name: 'Dana Reyes',
    role: 'The Talent / Actor',
    userProfile: {
      headline: 'Meet Dana Reyes',
      identityBullets: [
        'Working actor in her early 50s',
        'Submits self-tapes almost exclusively on mobile between auditions',
        'Tech-anxious when uploading high-stakes audition materials',
        'Familiar with casting jargon but not with opaque platform states',
      ],
    },
    thinkingStyle: {
      archetype: 'Panic Submitter',
      mindsetBullets: [
        'Engages with deadline pressure and high-stakes outcomes',
        'Needs explicit confirmation before trusting the platform',
        'Reads every status indicator literally under time stress',
      ],
      dominantCognitiveAxis: 'risk_averse',
      informationProcessingPreference: 'raw_data',
      visualContinuumPreference: 20,
    },
    frustrationTriggers: [
      'Vague video upload status ("Processing…" with no percentage, ETA, or upload-vs-convert distinction)',
      'Hidden pricing tokens for premium submissions discovered mid-flow',
      'No explicit audio-sync confirmation on self-tape previews',
      'No receipt-style confirmation naming the role and stating casting received the submission',
      'Small tap targets and destructive actions placed near primary CTAs on mobile',
      'Crop/preview tooling too small on phone to trust headshot or slate framing',
    ],
    judgmentRules:
      "Always: Confirm every irreversible action with explicit system feedback\nNever: Trust a spinner or 'Done' without naming what was received and by whom\nWatch for: Does this screen tell me exactly what happened, what will happen next, and whether casting has my materials?",
    traits: {
      techLiteracy: 35,
      frustrationThreshold: 30,
      industryExperience: 75,
    },
    color: '#8b5cf6',
  },
]

/** Swatch palette for persona accents (editor picker + custom defaults). */
export const PERSONA_COLORS = [
  '#8b5cf6', // violet
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
]

export function getPersona(id: string): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]
}

export const DEFAULT_PERSONA_IDS = PERSONAS.map((p) => p.id)

/** Factory copy of the built-in persona (deep enough to mutate safely). */
export function factoryPersona(id: string): Persona | undefined {
  const p = PERSONAS.find((d) => d.id === id)
  if (!p) return undefined
  return {
    ...p,
    traits: { ...p.traits },
    frustrationTriggers: [...p.frustrationTriggers],
    userProfile: { ...p.userProfile, identityBullets: [...p.userProfile.identityBullets] },
    thinkingStyle: {
      ...p.thinkingStyle,
      mindsetBullets: [...p.thinkingStyle.mindsetBullets],
    },
  }
}

export function blankPersona(): Persona {
  return {
    id: `custom-${Date.now()}`,
    name: '',
    role: '',
    frustrationTriggers: [],
    judgmentRules: '',
    userProfile: { headline: '', identityBullets: [] },
    thinkingStyle: {
      archetype: '',
      mindsetBullets: [],
      dominantCognitiveAxis: 'analytical',
      informationProcessingPreference: 'raw_data',
      visualContinuumPreference: 50,
    },
    traits: { techLiteracy: 50, frustrationThreshold: 50, industryExperience: 50 },
    custom: true,
    color: PERSONA_COLORS[3],
  }
}

/**
 * Builds a new persona draft from a thinking-style preset so authoring starts
 * strong instead of empty. Applies the preset's cognitive thinking style and
 * seeds the frustration triggers and judgment rules. Who fields (role, name,
 * identity) are left blank for the author. Passing 'blank' returns an
 * untouched blankPersona().
 */
export function personaFromPreset(presetId: string | 'blank'): Persona {
  const base = blankPersona()
  if (presetId === 'blank') return base

  const preset = getThinkingStylePreset(presetId)
  if (!preset) return base

  const style = preset.style
  return {
    ...base,
    thinkingStyle: {
      ...style,
      mindsetBullets: [...style.mindsetBullets],
    },
    frustrationTriggers: [...preset.frustrationTriggers],
    judgmentRules: preset.judgmentRules,
  }
}
