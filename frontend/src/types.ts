export interface PersonaTraits {
  /** 0-100: comfort with non-obvious affordances, jargon, hidden states */
  techLiteracy: number
  /** 0-100: how much confusion the persona absorbs before frustration spikes */
  frustrationThreshold: number
  /** 0-100: familiarity with casting workflow conventions */
  industryExperience: number
}

export interface Persona {
  id: string
  name: string
  role: string
  description: string
  deviceContext: string
  painPoints: string[]
  traits: PersonaTraits
  /** true for team-created personas (vs. the built-in industry blueprints) */
  custom?: boolean
  /** accent color used in cards, feed, history rows, and comparison charts */
  color?: string
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
  traits: PersonaTraits
  flowName: string
  taskGoal: string
  steps: FlowStep[]
  model: string
  mockMode: boolean
  /** full persona roster (built-ins + team-created), portable with the config */
  personas?: Persona[]
  /** team-saved flow library, portable with the config */
  savedFlows?: SavedFlow[]
}
