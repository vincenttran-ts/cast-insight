import type { SimulationRun, StepResult, SusReport } from '@/types'

/**
 * Analytics math for the report dashboard and the standalone export.
 */

export function avgFrustration(results: StepResult[]): number {
  if (!results.length) return 0
  return results.reduce((s, r) => s + r.frustration, 0) / results.length
}

export function completionRate(results: StepResult[]): number {
  if (!results.length) return 0
  return results.filter((r) => r.succeeded).length / results.length
}

export function efficiencyRatio(results: StepResult[]): number {
  // optimal steps / simulated steps — 1.0 is a perfect run, lower = fumbling.
  if (!results.length) return 0
  const optimal = results.length
  const simulated = results.reduce((s, r) => s + r.simulatedStepsTaken, 0)
  return simulated === 0 ? 0 : optimal / simulated
}

/**
 * SUS (System Usability Scale) synthesis.
 *
 * Classic SUS aggregates 10 Likert items into a 0-100 score. We synthesize
 * the equivalent from the simulation's three observable pillars, weighted
 * to mirror how SUS items split between effectiveness, efficiency, and
 * satisfaction (frustration inverse):
 *
 *   SUS = 100 * (0.40 * completion + 0.30 * efficiency + 0.30 * (1 - frustration/100))
 *
 * An abandon event applies a hard penalty, mirroring the catastrophic
 * effect task failure has on real SUS questionnaires.
 */
export function computeSus(results: StepResult[]): SusReport {
  const frustration = avgFrustration(results)
  const completion = completionRate(results)
  const efficiency = efficiencyRatio(results)
  const abandoned = results.some((r) => r.actionType === 'abandon')

  let score = 100 * (0.4 * completion + 0.3 * efficiency + 0.3 * (1 - frustration / 100))
  if (abandoned) score -= 18
  score = Math.max(0, Math.min(100, Math.round(score * 10) / 10))

  const { grade, label } = gradeSus(score)
  return {
    score,
    grade,
    label,
    completionRate: Math.round(completion * 100),
    avgFrustration: Math.round(frustration),
    efficiencyRatio: Math.round(efficiency * 100) / 100,
  }
}

export function gradeSus(score: number): { grade: string; label: string } {
  if (score >= 84.1) return { grade: 'A+', label: 'Best Imaginable — Frictionless Flow' }
  if (score >= 80.8) return { grade: 'A', label: 'Excellent — Ship It' }
  if (score >= 78.9) return { grade: 'A-', label: 'Excellent — Minor Polish Remaining' }
  if (score >= 77.2) return { grade: 'B+', label: 'Good — Above Industry Benchmark' }
  if (score >= 74.1) return { grade: 'B', label: 'Good — Solid Usability' }
  if (score >= 72.6) return { grade: 'B-', label: 'Good — Watch the Rough Edges' }
  if (score >= 71.1) return { grade: 'C+', label: 'OK — At Benchmark (68 is average)' }
  if (score >= 65.0) return { grade: 'C', label: 'OK — Usable But Unremarkable' }
  if (score >= 62.7) return { grade: 'C-', label: 'OK — Friction Is Visible' }
  if (score >= 51.7) return { grade: 'D', label: 'Poor — Significant Friction Detected' }
  return { grade: 'F', label: 'High Attrition Warning — Users Will Abandon' }
}

export interface FrustrationPoint {
  step: string
  stepIndex: number
  frustration: number
  confidence: number
}

export function frustrationCurve(results: StepResult[]): FrustrationPoint[] {
  return results.map((r) => ({
    step: `Step ${r.stepIndex + 1}`,
    stepIndex: r.stepIndex,
    frustration: r.frustration,
    confidence: r.confidence,
  }))
}

export interface EfficiencyPoint {
  step: string
  optimal: number
  simulated: number
}

export function efficiencyBars(results: StepResult[]): EfficiencyPoint[] {
  return results.map((r) => ({
    step: `Step ${r.stepIndex + 1}`,
    optimal: 1,
    simulated: r.simulatedStepsTaken,
  }))
}

export function totalSimulatedSteps(results: StepResult[]): number {
  return results.reduce((s, r) => s + r.simulatedStepsTaken, 0)
}

/** Steps the persona actually reached (< planned when they abandoned). */
export function attemptedSteps(run: SimulationRun): { attempted: number; planned: number } {
  return { attempted: run.results.length, planned: run.stepTexts.length }
}

/** 1-based step number where the persona abandoned, or null. */
export function abandonStep(results: StepResult[]): number | null {
  const hit = results.find((r) => r.actionType === 'abandon')
  return hit ? hit.stepIndex + 1 : null
}

export function collectUxIssues(run: SimulationRun): { step: number; issue: string }[] {
  return run.results.flatMap((r) => r.uxIssues.map((issue) => ({ step: r.stepIndex + 1, issue })))
}
