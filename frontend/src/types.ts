export interface PersonaTraits {
  /** 0-100: comfort with non-obvious affordances, jargon, hidden states */
  techLiteracy: number
  /** 0-100: how much confusion the persona absorbs before frustration spikes */
  frustrationThreshold: number
  /** 0-100: familiarity with casting workflow conventions */
  industryExperience: number
}

export type CognitiveAxis = 'analytical' | 'divergent' | 'systemic' | 'risk_averse'

export type InformationProcessingPreference = 'raw_data' | 'narrative'

export interface MentalRules {
  always: string
  never: string
}

export interface ThinkingStyle {
  /** Cognitive label for why they care — e.g. "Panic Submitter", not their job title */
  archetype: string
  /** 3–5 bullets: how they think / what motivates engagement */
  mindsetBullets: string[]
  /** NASA cognitive fields */
  dominantCognitiveAxis: CognitiveAxis
  informationProcessingPreference: InformationProcessingPreference
  /** 0 = Technical/No-Frills … 100 = Majestic/Immersive */
  visualContinuumPreference: number
  /** @deprecated merged into Persona.judgmentRules; kept only so migration can read old data */
  mentalRules?: MentalRules
  /** @deprecated merged into Persona.frustrationTriggers; kept only so migration can read old data */
  fluidityTriggers?: string
}

export interface UserProfile {
  /** Defaults to "Meet {name}" when empty */
  headline: string
  /** Traditional persona facts: role, age, interests, context */
  identityBullets: string[]
}

export interface WalkthroughBehavior {
  /** @deprecated merged into Persona.frustrationTriggers; kept only so migration can read old data */
  quitTriggers?: string
  /** @deprecated merged into Persona.judgmentRules; kept only so migration can read old data */
  uiEvaluationLens?: string
}

export interface Persona {
  id: string
  name: string
  role: string
  /** What frustrates or stops them — drives frustration score and abandonment */
  frustrationTriggers: string[]
  /** How they judge the UI (optional; preset-filled) */
  judgmentRules: string
  userProfile: UserProfile
  thinkingStyle: ThinkingStyle
  traits: PersonaTraits
  /** true for team-created personas (vs. the built-in blueprint) */
  custom?: boolean
  /** accent color used in cards, feed, history rows, and comparison charts */
  color?: string
  /** published to the team library */
  shared?: boolean
  authorName?: string
  updatedAt?: string
  /** @deprecated migrated into userProfile.identityBullets */
  description?: string
  /** @deprecated migrated into userProfile.identityBullets */
  deviceContext?: string
  /** @deprecated merged into frustrationTriggers; kept only so migration can read old data */
  painPoints?: string[]
  /** @deprecated merged into frustrationTriggers/judgmentRules; kept only so migration can read old data */
  walkthroughBehavior?: WalkthroughBehavior
}

export interface StepImage {
  /** base64 data URL or raw base64 */
  data: string
  mimeType: string
  name: string
}

export interface FlowStep {
  id: string
  text: string
  image?: StepImage
  /** what "done" looks like for this step; used to judge `succeeded` accurately */
  expectedOutcome?: string
}

export type ActionType =
  | 'click'
  | 'type'
  | 'scroll'
  | 'hesitate'
  | 'backtrack'
  | 'abandon'
  | 'complete'

export interface StepResult {
  stepIndex: number
  stepText: string
  /** objective inventory of UI elements the model grounded its judgment in */
  observedElements?: string
  innerMonologue: string
  action: string
  actionType: ActionType
  frustration: number
  confidence: number
  simulatedStepsTaken: number
  uxIssues: string[]
  succeeded: boolean
  /** data URL preview of the screenshot evaluated for this step */
  imagePreview?: string
}

export type RunStatus = 'idle' | 'running' | 'done' | 'error' | 'aborted'

export interface SimulationRun {
  id: string
  startedAt: string
  finishedAt?: string
  personaId: string
  personaName: string
  personaRole: string
  personaColor?: string
  traits: PersonaTraits
  thinkingStyle?: ThinkingStyle
  /** present when this run is part of a multi-persona batch */
  batch?: { index: number; total: number }
  flowName: string
  taskGoal: string
  model: string
  mock: boolean
  stepTexts: string[]
  results: StepResult[]
  status: RunStatus
  currentStep: number
  error?: string
}

export interface SusReport {
  score: number
  grade: string
  label: string
  completionRate: number
  avgFrustration: number
  efficiencyRatio: number
}

export interface SavedFlow {
  id: string
  name: string
  taskGoal: string
  steps: FlowStep[]
  savedAt: string
}

export interface AppConfig {
  personaId: string
  /** @deprecated traits live on personas; merged on import if present */
  traits?: PersonaTraits
  flowName: string
  taskGoal: string
  steps: FlowStep[]
  model: string
  mockMode: boolean
  /** full persona roster (built-in + team-created), portable with the config */
  personas?: Persona[]
  /** team-saved flow library, portable with the config */
  savedFlows?: SavedFlow[]
}
