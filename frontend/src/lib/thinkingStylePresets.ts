import type { CognitiveAxis, InformationProcessingPreference, ThinkingStyle } from '@/types'

export type ActorSegment = 'commercial' | 'film_tv' | 'both'

export interface ThinkingStylePreset {
  id: string
  label: string
  description: string
  /** Where this mindset shows up most in real casting workflows */
  segment: ActorSegment
  style: {
    archetype: string
    mindsetBullets: string[]
    dominantCognitiveAxis: ThinkingStyle['dominantCognitiveAxis']
    informationProcessingPreference: ThinkingStyle['informationProcessingPreference']
    visualContinuumPreference: number
  }
  frustrationTriggers: string[]
  judgmentRules: string
}

export const ACTOR_SEGMENT_LABELS: Record<ActorSegment, string> = {
  commercial: 'Commercial',
  film_tv: 'Film & TV',
  both: 'Cross-medium',
}

export const COGNITIVE_AXIS_OPTIONS: { value: CognitiveAxis; label: string }[] = [
  { value: 'analytical', label: 'Analytical' },
  { value: 'divergent', label: 'Divergent' },
  { value: 'systemic', label: 'Systemic' },
  { value: 'risk_averse', label: 'Risk-averse' },
]

export const INFO_PREFERENCE_OPTIONS: { value: InformationProcessingPreference; label: string }[] = [
  { value: 'raw_data', label: 'Raw data (bits & bobs)' },
  { value: 'narrative', label: 'High-level narrative' },
]

/**
 * Actor-tailored thinking styles for commercial and film/TV self-tape workflows.
 * Grounded in how talent actually submits under volume, brief compliance, and technical stakes.
 */
export const THINKING_STYLE_PRESETS: ThinkingStylePreset[] = [
  {
    id: 'panic-submitter',
    label: 'Panic Submitter',
    segment: 'both',
    description: 'Mobile deadline submitter — high stakes, zero tolerance for ambiguous upload states',
    style: {
      archetype: 'Panic Submitter',
      mindsetBullets: [
        'Treats every audition window like it may close before the upload finishes',
        'Needs explicit confirmation before trusting the platform with irreplaceable takes',
        'Reads status labels literally under time stress — "Processing" is not "Received"',
      ],
      dominantCognitiveAxis: 'risk_averse',
      informationProcessingPreference: 'raw_data',
      visualContinuumPreference: 20,
    },
    frustrationTriggers: [
      'Deadline pressure',
      'upload ambiguity',
      'surprise fees',
      'destructive actions near primary CTAs',
    ],
    judgmentRules:
      "Always: Confirm every irreversible action with explicit system feedback before leaving the screen\nNever: Trust a spinner or 'Done' without naming what was received and by whom",
  },
  {
    id: 'brief-purist',
    label: 'Brief Purist',
    segment: 'commercial',
    description: 'Procedural commercial talent — follows casting instructions to the letter',
    style: {
      archetype: 'Brief Purist',
      mindsetBullets: [
        'Commercial casting is procedural — wardrobe, slate format, and deliverables must match the brief exactly',
        'Treats improvisation around specs as risk; compliance is part of the performance',
        'Assumes CDs are sorting hundreds of tapes and will discard non-compliant files without feedback',
      ],
      dominantCognitiveAxis: 'analytical',
      informationProcessingPreference: 'raw_data',
      visualContinuumPreference: 25,
    },
    frustrationTriggers: [
      'Conflicting instructions',
      'missing spec checklist',
      'or UI that hides required deliverables until the last step',
    ],
    judgmentRules:
      'Always: Re-read breakdown requirements before uploading — ident, profiles, length, and takes\nNever: Submit landscape when they asked portrait, or skip a requested size frame or slate beat',
  },
  {
    id: 'spot-ready-player',
    label: 'Spot-Ready Player',
    segment: 'commercial',
    description: 'Commercial personality-first — optimizes for the first 10 seconds CDs actually watch',
    style: {
      archetype: 'Spot-Ready Player',
      mindsetBullets: [
        'Knows commercial CDs often decide in the first 10–20 seconds — slate is a brand moment, not admin',
        'Prioritizes energized, specific, camera-present energy over theatrical depth',
        'Frustrated when upload friction eats prep time meant for takes and slate polish',
      ],
      dominantCognitiveAxis: 'divergent',
      informationProcessingPreference: 'narrative',
      visualContinuumPreference: 45,
    },
    frustrationTriggers: [
      'Tight same-day turnarounds',
      'unclear slate expectations',
      'or flows that bury the record step under settings',
    ],
    judgmentRules:
      'Always: Front-load ident and personality in the slate before the scene work\nNever: Waste turnaround time troubleshooting tech when the tape should be about instant readability',
  },
  {
    id: 'scene-first-actor',
    label: 'Scene-First Actor',
    segment: 'film_tv',
    description: 'Film/TV talent — character-driven, grounded, reads sides for subtext and given circumstances',
    style: {
      archetype: 'Scene-First Actor',
      mindsetBullets: [
        'Approaches self-tapes as compressed scene work — choices, listening, and specificity over "type"',
        'More patient with prep complexity if it supports performance; less tolerant of generic platform copy',
        'Expects breakdown context (tone, relationship, stakes) to stay visible while taping and submitting',
      ],
      dominantCognitiveAxis: 'systemic',
      informationProcessingPreference: 'narrative',
      visualContinuumPreference: 55,
    },
    frustrationTriggers: [
      'Breakdown details buried after login',
      'lost role context mid-flow',
      'or prompts that ignore character stakes',
    ],
    judgmentRules:
      'Always: Keep sides, tone notes, and character context accessible through the whole submission flow\nNever: Flatten a nuanced role into a checkout flow that treats the audition like a file upload only',
  },
  {
    id: 'technical-gatekeeper',
    label: 'Technical Gatekeeper',
    segment: 'both',
    description: 'Won\'t hit send until audio, framing, and sync pass their personal QC bar',
    style: {
      archetype: 'Technical Gatekeeper',
      mindsetBullets: [
        'Knows CDs often reject tapes on technical faults before the performance is judged',
        'Obsesses over audio sync, headroom, and preview fidelity — especially on phone uploads',
        'Would rather re-record than submit a take they cannot verify met casting-ready standards',
      ],
      dominantCognitiveAxis: 'analytical',
      informationProcessingPreference: 'raw_data',
      visualContinuumPreference: 30,
    },
    frustrationTriggers: [
      'Tiny previews',
      'missing audio confirmation',
      'compression artifacts',
      'or crop tools that hide the real frame',
    ],
    judgmentRules:
      'Always: Preview audio, framing, and file integrity on the actual device used to submit\nNever: Submit when preview is cropped, silent, or too small to trust on mobile',
  },
  {
    id: 'volume-grinder',
    label: 'Volume Grinder',
    segment: 'both',
    description: 'High weekly submission volume — optimizes for repeatable, low-friction tape-and-send rhythm',
    style: {
      archetype: 'Volume Grinder',
      mindsetBullets: [
        'Submits multiple self-tapes per week and treats each extra click as lost prep time',
        'Wants a repeatable workflow: breakdown → record → review → submit with predictable steps',
        'Accepts some complexity only when it clearly prevents costly re-shoots or re-uploads',
      ],
      dominantCognitiveAxis: 'analytical',
      informationProcessingPreference: 'raw_data',
      visualContinuumPreference: 35,
    },
    frustrationTriggers: [
      'Inconsistent flows between roles',
      're-auth loops',
      'or one-off UI changes that break habit',
    ],
    judgmentRules:
      'Always: Reuse the same submission path once it worked — muscle memory beats exploration\nNever: Re-learn a flow that moved buttons, renamed states, or added surprise steps mid-season',
  },
  {
    id: 'receipt-hunter',
    label: 'Receipt Hunter',
    segment: 'both',
    description: 'Needs audit-trail proof casting received the right role, file, and timestamp',
    style: {
      archetype: 'Receipt Hunter',
      mindsetBullets: [
        'Distinguishes "left my phone" from "casting has my tape" — those are different outcomes',
        'Cross-checks platform status against agent emails and breakdown confirmations',
        'Slows or stops when timestamps, role names, or submission IDs are missing from confirmation',
      ],
      dominantCognitiveAxis: 'risk_averse',
      informationProcessingPreference: 'raw_data',
      visualContinuumPreference: 22,
    },
    frustrationTriggers: [
      'Vague confirmations',
      'conflicting statuses',
      'or silence after submit that forces agent follow-up',
    ],
    judgmentRules:
      'Always: Require a receipt naming the project, role, timestamp, and received-by-casting language\nNever: Close the tab on a generic success toast that could mean anything',
  },
  {
    id: 'callback-waiter',
    label: 'Callback Waiter',
    segment: 'film_tv',
    description: 'Film/TV talent in later stages — careful, rep-aware, treats platform as professional pipeline',
    style: {
      archetype: 'Callback Waiter',
      mindsetBullets: [
        'Has passed initial self-tape filtering — now hyper-aware of professionalism and rep visibility',
        'Reads every platform message as potentially shareable with their agent or casting office',
        'Less rushed than first-round submits, but less forgiving of errors that look amateur to reps',
      ],
      dominantCognitiveAxis: 'systemic',
      informationProcessingPreference: 'narrative',
      visualContinuumPreference: 50,
    },
    frustrationTriggers: [
      'Unprofessional error copy',
      'ambiguous rep visibility',
      'or statuses that make them look disorganized',
    ],
    judgmentRules:
      'Always: Act as if the rep could see this submission history and status trail\nNever: Send materials that would embarrass me if forwarded to casting or my agent cold',
  },
]

export function getThinkingStylePreset(id: string): ThinkingStylePreset | undefined {
  return THINKING_STYLE_PRESETS.find((p) => p.id === id)
}

export function presetSelectLabel(preset: ThinkingStylePreset): string {
  const seg = ACTOR_SEGMENT_LABELS[preset.segment]
  return `${seg} · ${preset.label}`
}
