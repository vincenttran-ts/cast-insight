import type { SimulationRun, UxIssue, UxIssueScope } from '@/types'

const UX_ISSUE_SCOPES = new Set<UxIssueScope>([
  'structure',
  'interaction',
  'feedback',
  'accessibility',
  'content',
])

export const UX_ISSUE_SCOPE_LABELS: Record<UxIssueScope, string> = {
  structure: 'Structure',
  interaction: 'Interaction',
  feedback: 'Feedback',
  accessibility: 'Accessibility',
  content: 'Content',
}

/** Coerce legacy string issues or structured objects into UxIssue[]. */
export function normalizeUxIssue(raw: unknown): UxIssue | null {
  if (raw && typeof raw === 'object' && 'issue' in raw) {
    const obj = raw as { scope?: string; issue?: unknown }
    const issue = String(obj.issue ?? '').trim()
    if (!issue) return null
    const scope = UX_ISSUE_SCOPES.has(obj.scope as UxIssueScope)
      ? (obj.scope as UxIssueScope)
      : 'interaction'
    return { scope, issue }
  }
  const text = String(raw ?? '').trim()
  if (!text) return null
  return { scope: 'interaction', issue: text }
}

export function normalizeUxIssues(raw: unknown): UxIssue[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeUxIssue).filter((i): i is UxIssue => i !== null)
}

/** Product-design issues exclude content-scope findings (seed data nitpicks). */
export function isProductDesignIssue(issue: UxIssue): boolean {
  return issue.scope !== 'content'
}

export function formatUxIssue(issue: UxIssue): string {
  return issue.issue
}

export function collectProductDesignIssues(
  run: SimulationRun
): { step: number; issue: UxIssue }[] {
  return run.results.flatMap((r) =>
    normalizeUxIssues(r.uxIssues)
      .filter(isProductDesignIssue)
      .map((issue) => ({ step: r.stepIndex + 1, issue }))
  )
}
