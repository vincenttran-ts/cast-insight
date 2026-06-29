import type { Persona, StepResult } from '@/types'

/**
 * Thin client for the CastInsight Express gateway. The Gemini API key lives
 * only in client state and rides on each request via the x-gemini-api-key
 * header; the backend never persists it.
 */

export interface SimulateStepRequest {
  apiKey: string
  model: string
  persona: Persona
  step: string
  stepIndex: number
  totalSteps: number
  taskGoal: string
  priorContext: Pick<StepResult, 'action' | 'frustration' | 'succeeded'>[]
  image?: { data: string; mimeType: string }
}

export type SimulateStepResponse = Omit<StepResult, 'stepIndex' | 'stepText' | 'imagePreview'>

export async function simulateStep(req: SimulateStepRequest): Promise<SimulateStepResponse> {
  const res = await fetch('/api/simulate-step', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-gemini-api-key': req.apiKey,
    },
    body: JSON.stringify({
      model: req.model,
      persona: req.persona,
      step: req.step,
      stepIndex: req.stepIndex,
      totalSteps: req.totalSteps,
      taskGoal: req.taskGoal,
      priorContext: req.priorContext,
      image: req.image,
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || `Backend error (${res.status})`)
  }
  return body as SimulateStepResponse
}

export async function validateKey(apiKey: string, model: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/validate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-gemini-api-key': apiKey },
      body: JSON.stringify({ model }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        return {
          ok: false,
          error:
            'Backend unreachable. From the project root run npm run dev (or npm run dev:backend) so the API gateway is listening on :3001.',
        }
      }
      return { ok: false, error: body.error || `Validation failed (${res.status})` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Backend unreachable — is it running on :3001?' }
  }
}
