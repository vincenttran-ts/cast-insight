import type { Persona } from '@/types'

/**
 * Pre-programmed entertainment-industry personas for Casting Networks
 * cognitive walkthroughs. Trait values are starting calibrations that the
 * designer can adjust per-run with sliders in the PersonaPanel.
 */
export const PERSONAS: Persona[] = [
  {
    id: 'talent-actor',
    name: 'Dana Reyes',
    role: 'The Talent / Actor',
    description:
      'Working actor in her early 50s, almost exclusively on mobile between auditions. Tech-anxious when submitting high-stakes materials: a self-tape due in 40 minutes is a panic scenario, not a workflow. Reads every status indicator literally and assumes the worst when one is missing.',
    deviceContext: 'Mobile (iPhone, often on cellular between auditions)',
    painPoints: [
      'Vague video file upload status updates ("Processing…" with no percentage or ETA)',
      'Hidden pricing tokens for premium submissions discovered mid-flow',
      'Unconfirmed self-tape audio processing indicators (did my audio sync? is it muted?)',
      'No explicit "your submission was received by casting" confirmation moment',
      'Small tap targets and destructive actions placed near primary CTAs',
    ],
    traits: {
      techLiteracy: 35,
      frustrationThreshold: 30,
      industryExperience: 75,
    },
    color: '#8b5cf6',
  },
  {
    id: 'talent-rep',
    name: 'Marcus Cole',
    role: 'The Talent Rep (Agent/Manager)',
    description:
      'Fast-paced agency rep managing 120 clients across multiple monitors and a dozen browser tabs. Lives in grids, expects keyboard shortcuts, and measures every workflow in submissions-per-minute. Anything that forces one-at-a-time interaction is a personal insult.',
    deviceContext: 'Desktop power user (multi-monitor, 12+ tabs, keyboard-first)',
    painPoints: [
      'Mandatory pagination instead of infinite scroll or "show 500" density options',
      'Slow visual modals that block the page for single-record actions',
      'No bulk-select / bulk-submit grid actions for client rosters',
      'Missing keyboard shortcuts for repetitive submission triage',
      'Low information density: cards where a table should be',
    ],
    traits: {
      techLiteracy: 90,
      frustrationThreshold: 45,
      industryExperience: 95,
    },
    color: '#0ea5e9',
  },
  {
    id: 'casting-director',
    name: 'Priya Anand',
    role: 'The Casting Director',
    description:
      'Casting director running three episodic projects at once from a dense desktop dashboard. Relies intensely on advanced multi-layered filtering, side-by-side performance asset comparison, and rapid media-tagging shortcuts. Tolerates complexity, but never tolerates losing filter state.',
    deviceContext: 'Desktop dashboard heavy (large display, long sessions)',
    painPoints: [
      'Filters that reset after navigating into a profile and back',
      'No side-by-side comparison view for self-tapes and headshots',
      'Media tagging that requires more than one click/keystroke per tag',
      'Search facets that hide instead of stacking (single-layer filtering)',
      'Slow thumbnail loading in large submission grids',
    ],
    traits: {
      techLiteracy: 80,
      frustrationThreshold: 55,
      industryExperience: 98,
    },
    color: '#10b981',
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

/** Factory copy of a built-in persona (deep enough to mutate safely). */
export function factoryPersona(id: string): Persona | undefined {
  const p = PERSONAS.find((d) => d.id === id)
  return p ? { ...p, traits: { ...p.traits }, painPoints: [...p.painPoints] } : undefined
}

export function blankPersona(): Persona {
  return {
    id: `custom-${Date.now()}`,
    name: '',
    role: '',
    description: '',
    deviceContext: '',
    painPoints: [],
    traits: { techLiteracy: 50, frustrationThreshold: 50, industryExperience: 50 },
    custom: true,
    color: PERSONA_COLORS[3],
  }
}
