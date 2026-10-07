import type { ActionType, Persona, StepResult, UxIssue } from '@/types'
import { personaContextText } from '@/lib/personaDefaults'

/**
 * Sandbox Mock Mode engine.
 *
 * Produces context-aware simulated results without calling Gemini: it scans
 * the step text for casting-domain triggers (uploads, tokens, processing…),
 * cross-references them against the active persona's pain points and thinking
 * style, and synthesizes a plausible monologue, action, and frustration value.
 */

interface TriggerRule {
  pattern: RegExp
  appliesTo: string[] // persona ids; empty = all
  frustrationBoost: number
  monologue: (persona: Persona) => string
  issue: string
}

const TRIGGER_RULES: TriggerRule[] = [
  {
    pattern: /upload|video file|\.mov|\.mp4|file from/i,
    appliesTo: ['talent-actor'],
    frustrationBoost: 22,
    monologue: () =>
      "The upload bar is moving but it just says 'Processing…' — processing what? Is it uploading or converting? My deadline is in 40 minutes and I genuinely can't tell if I can close this tab.",
    issue: 'Upload state is ambiguous: no percentage, ETA, or distinction between uploading vs. server-side processing.',
  },
  {
    pattern: /audio|sync|sound/i,
    appliesTo: ['talent-actor'],
    frustrationBoost: 18,
    monologue: () =>
      "I see a video thumbnail but nothing tells me the audio made it through. Last time my reader's lines were silent and I lost the audition. I need an explicit audio-confirmed indicator before I trust this.",
    issue: 'No explicit audio processing confirmation; talent cannot verify audio synced without replaying the asset.',
  },
  {
    pattern: /token|premium|pricing|pay|fee/i,
    appliesTo: ['talent-actor'],
    frustrationBoost: 28,
    monologue: () =>
      "Wait — a Media Profile Token? Nobody mentioned a cost until now, four steps into a deadline submission. Is this charging my card? Why is the price hidden behind this jargon instead of a dollar amount up front?",
    issue: 'Premium pricing token is revealed mid-flow with jargon naming and no upfront cost disclosure.',
  },
  {
    pattern: /processing|wait|recalculat|render/i,
    appliesTo: ['talent-actor'],
    frustrationBoost: 15,
    monologue: () =>
      "It's been sitting on this spinner for a while now. Has it paused? Failed? Finished? There's no timestamp, no progress, nothing telling me whether walking away is safe.",
    issue: 'Long-running processing state lacks progress detail, completion estimate, or a safe-to-leave signal.',
  },
  {
    pattern: /crop|headshot|photo|image|thumbnail/i,
    appliesTo: ['talent-actor'],
    frustrationBoost: 12,
    monologue: () =>
      "This crop preview is tiny on my phone and I can't tell if my eyes line up with the rule-of-thirds guide. This headshot cost me $600 — I am not confirming a crop I can't actually see.",
    issue: 'Crop/preview tooling is undersized on mobile; no zoom or per-context thumbnail preview.',
  },
  {
    pattern: /confirm|submitted|received|verification/i,
    appliesTo: ['talent-actor'],
    frustrationBoost: 10,
    monologue: () =>
      "Okay, it says 'Done' — but done as in casting HAS my tape, or done as in it left my phone? I want a receipt: timestamp, role name, and the words 'received by casting'. Anything less and I'll email my agent to double-check.",
    issue: "Confirmation copy doesn't explicitly state the submission reached casting; users seek external reassurance.",
  },
]

const BASELINE_MONOLOGUES: Record<string, string[]> = {
  'talent-actor': [
    "Alright, I can see what they want me to tap, but I'm reading every label twice — with a booking on the line I don't trust myself to guess.",
    'This screen is fine, I think. The button is big enough. I just keep wondering what happens after I tap it, because nothing here tells me.',
    "Okay, that step worked, deep breath. The label could have been clearer but the layout pointed me in the right direction.",
  ],
}

const GENERIC_BASELINES = [
  'Okay, I can see what this screen wants from me. Nothing here contradicts what I expected, so I keep moving.',
  "This step is fine, though I notice I'm relying on guesswork about what happens next — a hint of the outcome would help.",
  'Straightforward enough. The main action stands out and the labels match the words I would use myself.',
]

const ACTION_VERBS: Record<string, string> = {
  click: 'CLICK',
  type: 'TYPE',
  scroll: 'SCROLL',
}

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

function extractActionLabel(stepText: string): string {
  const quoted = stepText.match(/'([^']+)'|"([^"]+)"/)
  if (quoted) return `${ACTION_VERBS.click} '${quoted[1] || quoted[2]}'`
  if (/type|enter|fill/i.test(stepText)) return 'TYPE into the focused field'
  if (/wait|processing/i.test(stepText)) return 'WAIT on processing state, re-checking status'
  if (/choose|select|pick/i.test(stepText)) return 'SELECT the target item from the picker'
  if (/navigate|open|go to/i.test(stepText)) return 'NAVIGATE to the target screen'
  if (/review|verify|check/i.test(stepText)) return 'SCAN the screen verifying expected state'
  return 'CLICK the primary call-to-action'
}

function axisFrustrationBoost(persona: Persona, stepText: string, hits: TriggerRule[]): number {
  const axis = persona.thinkingStyle.dominantCognitiveAxis
  if (axis === 'risk_averse' && hits.length > 0) return 6
  if (axis === 'analytical' && /ambiguous|unclear|vague|processing|status/i.test(stepText)) return 4
  if (axis === 'divergent' && /only one|forced|linear|dead-end/i.test(stepText)) return 3
  return 0
}

function visualContinuumBoost(persona: Persona, stepText: string): number {
  const visual = persona.thinkingStyle.visualContinuumPreference
  if (visual < 40 && /marketing|hero|banner|celebrat|welcome|story/i.test(stepText)) return 5
  if (visual > 70 && /blank|sparse|minimal|no context|utility/i.test(stepText)) return 5
  if (visual < 40 && /processing|status|upload|confirm/i.test(stepText) && !/%|eta|received|uploaded/i.test(stepText)) {
    return 6
  }
  return 0
}

function infoPreferenceIssue(persona: Persona, stepText: string): string | null {
  const pref = persona.thinkingStyle.informationProcessingPreference
  if (pref === 'raw_data' && /processing|upload|submit|confirm/i.test(stepText) && !/%|timestamp|received|status:/i.test(stepText)) {
    return 'Raw-data thinker needs explicit status labels, counts, or timestamps — narrative copy alone is insufficient.'
  }
  if (pref === 'narrative' && /error|failed|invalid/i.test(stepText) && !/because|why|next|help/i.test(stepText)) {
    return 'Narrative-oriented user needs contextual explanation, not bare error codes.'
  }
  return null
}

export interface MockStepInput {
  persona: Persona
  stepText: string
  stepIndex: number
  totalSteps: number
  priorFrustration: number
  hasImage: boolean
}

export function mockSimulateStep(input: MockStepInput): Omit<StepResult, 'stepIndex' | 'stepText' | 'imagePreview'> {
  const { persona, stepText, stepIndex, totalSteps, priorFrustration, hasImage } = input
  const rand = seededRandom(
    stepText.length * 31 + stepIndex * 7 + persona.id.length * 13 + persona.traits.techLiteracy
  )

  const contextText = personaContextText(persona)
  const hits = TRIGGER_RULES.filter(
    (r) =>
      r.pattern.test(stepText) &&
      (r.appliesTo.length === 0 || r.appliesTo.includes(persona.id) || r.pattern.test(contextText))
  )

  const literacyPenalty = (100 - persona.traits.techLiteracy) * 0.15
  const thresholdPenalty = (100 - persona.traits.frustrationThreshold) * 0.2
  const experienceRelief = persona.traits.industryExperience * 0.08

  const triggerBoost = hits.reduce((sum, h) => sum + h.frustrationBoost, 0)
  const carryOver = priorFrustration * 0.35
  const noise = rand() * 8 - 4

  const triggerText = persona.frustrationTriggers.join(' ')
  const quitKeywordBoost = triggerText && /upload|fee|token|confirm|processing|ambiguous|hidden/i.test(stepText) ? 8 : 0
  const axisBoost = axisFrustrationBoost(persona, stepText, hits)
  const visualBoost = visualContinuumBoost(persona, stepText)

  let frustration = clamp(
    12 +
      triggerBoost +
      literacyPenalty +
      thresholdPenalty -
      experienceRelief +
      carryOver +
      noise +
      quitKeywordBoost +
      axisBoost +
      visualBoost,
    3,
    100
  )

  const abandonPoint = 55 + persona.traits.frustrationThreshold * 0.4
  const willAbandon = frustration > abandonPoint && stepIndex < totalSteps - 1 && hits.length > 0

  let actionType: ActionType
  let action: string
  if (willAbandon && frustration > abandonPoint + 15) {
    actionType = 'abandon'
    action = 'ABANDON task — frustration exceeded persona threshold'
  } else if (willAbandon) {
    actionType = 'backtrack'
    action = 'BACK-TRACK to previous screen hunting for reassurance'
    frustration = clamp(frustration - 5, 3, 100)
  } else if (hits.length > 0 && frustration > 45) {
    actionType = 'hesitate'
    action = `HESITATE, then ${extractActionLabel(stepText)}`
  } else if (stepIndex === totalSteps - 1) {
    actionType = 'complete'
    action = 'COMPLETE flow — final state reached'
  } else {
    actionType = /wait|processing/i.test(stepText) ? 'scroll' : 'click'
    action = extractActionLabel(stepText)
  }

  const monologueParts: string[] = []
  const style = persona.thinkingStyle
  const mindset = style.mindsetBullets?.[0]?.trim()

  if (hits.length > 0) {
    if (persona.custom || persona.shared) {
      const matchedTrigger = persona.frustrationTriggers.find((t) => hits.some((h) => h.pattern.test(t)))
      monologueParts.push(
        matchedTrigger
          ? `This screen is hitting one of my sore spots — ${matchedTrigger.replace(/\.$/, '').toLowerCase()}. I'm slowing down and re-reading everything before I commit to anything.`
          : hits[0].monologue(persona)
      )
    } else {
      monologueParts.push(hits[0].monologue(persona))
      if (hits.length > 1 && rand() > 0.4) monologueParts.push(hits[1].monologue(persona))
    }
  } else {
    const pool = BASELINE_MONOLOGUES[persona.id] ?? GENERIC_BASELINES
    monologueParts.push(pool[Math.floor(rand() * pool.length)])
  }

  if (mindset && rand() > 0.45) {
    monologueParts.push(`As a ${style.archetype}, ${mindset.replace(/\.$/, '').toLowerCase()}.`)
  }
  const firstTrigger = persona.frustrationTriggers[0]?.trim()
  if (firstTrigger && hits.length > 0 && rand() > 0.5) {
    monologueParts.push(`What trips me up is ${firstTrigger.replace(/\.$/, '').toLowerCase()}.`)
  }
  if (!hasImage && rand() > 0.6) {
    monologueParts.push("(I'm picturing this screen from the description alone — show me the real layout and I'll be pickier.)")
  }

  const uxIssues: UxIssue[] = hits.map((h) => ({ scope: 'interaction', issue: h.issue }))
  const prefIssue = infoPreferenceIssue(persona, stepText)
  if (prefIssue && !uxIssues.some((i) => i.issue === prefIssue)) {
    uxIssues.push({ scope: 'feedback', issue: prefIssue })
  }

  const simulatedStepsTaken =
    actionType === 'abandon'
      ? 2
      : actionType === 'backtrack'
        ? 3
        : actionType === 'hesitate'
          ? 2
          : frustration > 60 && rand() > 0.5
            ? 2
            : 1

  return {
    innerMonologue: monologueParts.join(' '),
    action,
    actionType,
    frustration,
    confidence: clamp(100 - frustration * 0.8 - (hasImage ? 0 : 6) + rand() * 10, 5, 98),
    simulatedStepsTaken,
    uxIssues,
    succeeded: actionType !== 'abandon' && actionType !== 'backtrack',
  }
}
