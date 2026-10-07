import { useCallback, useRef, useState } from 'react'
import type { FlowStep, Persona, SimulationRun, StepResult } from '@/types'
import { simulateStep } from '@/lib/api'
import { mockSimulateStep } from '@/lib/mockEngine'
import { normalizeUxIssues } from '@/lib/uxIssues'

export interface RunOptions {
  persona: Persona
  steps: FlowStep[]
  flowName: string
  taskGoal: string
  evaluationBrief?: string
  model: string
  mockMode: boolean
  apiKey: string
}

/**
 * Drives the agentic simulation loop: for each flow step, dispatches the
 * text + screenshot context to the Gemini gateway (or the sandbox mock
 * engine) sequentially, streaming StepResults into state as they land so
 * the SimulatorFeed renders live. An abandon action ends the run early,
 * exactly like a real participant walking away.
 *
 * `onRunFinished` fires for every run that reaches `done` or `aborted`
 * (not `error`) — App uses it to archive runs into history.
 * `startBatch` walks the same flow with several personas back-to-back.
 */
export function useSimulation(onRunFinished?: (run: SimulationRun) => void) {
  const [run, setRun] = useState<SimulationRun | null>(null)
  const abortRef = useRef(false)
  const liveRunRef = useRef<SimulationRun | null>(null)

  // Keep the archive callback fresh without re-creating the loop closures.
  const onFinishedRef = useRef(onRunFinished)
  onFinishedRef.current = onRunFinished

  const commit = useCallback((r: SimulationRun) => {
    liveRunRef.current = r
    setRun(r)
  }, [])

  const abort = useCallback(() => {
    abortRef.current = true
    const live = liveRunRef.current
    if (live && live.status === 'running') {
      const final: SimulationRun = { ...live, status: 'aborted', finishedAt: new Date().toISOString() }
      commit(final)
      if (final.results.length > 0) onFinishedRef.current?.(final)
    }
  }, [commit])

  const clear = useCallback(() => {
    abortRef.current = true
    liveRunRef.current = null
    setRun(null)
  }, [])

  const runOnce = useCallback(
    async (opts: RunOptions, batch?: { index: number; total: number }): Promise<SimulationRun | null> => {
      const { persona, steps, flowName, taskGoal, evaluationBrief, model, mockMode, apiKey } = opts
      abortRef.current = false

      const baseRun: SimulationRun = {
        id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        startedAt: new Date().toISOString(),
        personaId: persona.id,
        personaName: persona.name,
        personaRole: persona.role,
        personaColor: persona.color,
        traits: { ...persona.traits },
        thinkingStyle: persona.thinkingStyle ? { ...persona.thinkingStyle } : undefined,
        batch,
        flowName,
        taskGoal,
        model,
        mock: mockMode,
        stepTexts: steps.map((s) => s.text),
        results: [],
        status: 'running',
        currentStep: 0,
      }
      commit(baseRun)

      const results: StepResult[] = []

      for (let i = 0; i < steps.length; i++) {
        if (abortRef.current) return null

        commit({ ...baseRun, results: [...results], currentStep: i })
        const step = steps[i]
        const imagePreview = step.image?.data
          ? step.image.data.startsWith('data:')
            ? step.image.data
            : `data:${step.image.mimeType};base64,${step.image.data}`
          : undefined

        try {
          let outcome: Omit<StepResult, 'stepIndex' | 'stepText' | 'imagePreview'>

          if (mockMode) {
            // Small stagger so the feed reads like a live agent, not a dump.
            await sleep(650 + Math.random() * 600)
            outcome = mockSimulateStep({
              persona,
              stepText: step.text,
              stepIndex: i,
              totalSteps: steps.length,
              priorFrustration: results.length ? results[results.length - 1].frustration : 0,
              hasImage: Boolean(step.image),
            })
            outcome = { ...outcome, uxIssues: normalizeUxIssues(outcome.uxIssues) }
          } else {
            outcome = await simulateStep({
              apiKey,
              model,
              persona,
              step: step.text,
              stepIndex: i,
              totalSteps: steps.length,
              taskGoal,
              evaluationBrief,
              expectedOutcome: step.expectedOutcome,
              designNotes: step.designNotes,
              priorContext: results.map((r) => ({
                action: r.action,
                frustration: r.frustration,
                succeeded: r.succeeded,
              })),
              image: step.image ? { data: step.image.data, mimeType: step.image.mimeType } : undefined,
            })
          }

          if (abortRef.current) return null

          const result: StepResult = {
            ...outcome,
            uxIssues: normalizeUxIssues(outcome.uxIssues),
            stepIndex: i,
            stepText: step.text,
            imagePreview,
          }
          results.push(result)
          commit({ ...baseRun, results: [...results], currentStep: i })

          if (result.actionType === 'abandon') break
        } catch (err) {
          if (abortRef.current) return null
          commit({
            ...baseRun,
            results: [...results],
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown simulation error',
            finishedAt: new Date().toISOString(),
          })
          return null
        }
      }

      const final: SimulationRun = {
        ...baseRun,
        results: [...results],
        status: 'done',
        currentStep: steps.length,
        finishedAt: new Date().toISOString(),
      }
      commit(final)
      onFinishedRef.current?.(final)
      return final
    },
    [commit]
  )

  const start = useCallback((opts: RunOptions) => runOnce(opts), [runOnce])

  const startBatch = useCallback(
    async (personaList: Persona[], opts: Omit<RunOptions, 'persona'>): Promise<SimulationRun[]> => {
      const finished: SimulationRun[] = []
      for (let i = 0; i < personaList.length; i++) {
        const result = await runOnce(
          { ...opts, persona: personaList[i] },
          { index: i + 1, total: personaList.length }
        )
        if (!result) break // aborted or errored — stop the batch
        finished.push(result)
      }
      return finished
    },
    [runOnce]
  )

  return { run, start, startBatch, abort, clear }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
