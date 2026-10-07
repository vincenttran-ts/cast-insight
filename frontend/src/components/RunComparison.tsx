import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDown, ArrowUp, GitCompareArrows, Minus, X } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatUxIssue, isProductDesignIssue, normalizeUxIssues } from '@/lib/uxIssues'
import { computeSus, totalSimulatedSteps } from '@/lib/metrics'
import { PERSONA_COLORS } from '@/lib/personas'
import type { SimulationRun } from '@/types'

interface RunComparisonProps {
  runs: SimulationRun[]
  onClose: () => void
}

function runLabel(run: SimulationRun, index: number, runs: SimulationRun[]) {
  const samePersona = runs.filter((r) => r.personaId === run.personaId).length > 1
  const time = new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return samePersona ? `${run.personaRole} · ${time}` : run.personaRole || `Run ${index + 1}`
}

function runColor(run: SimulationRun, index: number) {
  return run.personaColor ?? PERSONA_COLORS[index % PERSONA_COLORS.length]
}

const TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
  color: 'hsl(var(--popover-foreground))',
}

export function RunComparison({ runs, onClose }: RunComparisonProps) {
  const susList = runs.map((r) => computeSus(r.results))
  const baseSus = susList[0]?.score ?? 0

  // Frustration curves merged by step index: [{ step, run0, run1, … }]
  const maxSteps = Math.max(...runs.map((r) => r.results.length))
  const curveData = Array.from({ length: maxSteps }, (_, i) => {
    const point: Record<string, number | string> = { step: `S${i + 1}` }
    runs.forEach((r, ri) => {
      if (r.results[i]) point[`run${ri}`] = r.results[i].frustration
    })
    return point
  })

  // Interactions per run vs planned steps
  const effData = runs.map((r, ri) => ({
    name: runLabel(r, ri, runs),
    planned: r.stepTexts.length,
    simulated: totalSimulatedSteps(r.results),
    fill: runColor(r, ri),
  }))

  // Issue diff: shared (appearing in 2+ runs) vs unique per run
  const issueSets = runs.map((r) =>
    new Set(
      r.results.flatMap((res) =>
        normalizeUxIssues(res.uxIssues)
          .filter(isProductDesignIssue)
          .map(formatUxIssue)
      )
    )
  )
  const allIssues = [...new Set(issueSets.flatMap((s) => [...s]))]
  const sharedIssues = allIssues.filter((i) => issueSets.filter((s) => s.has(i)).length >= 2)
  const uniqueIssues = runs.map((_, ri) =>
    [...issueSets[ri]].filter((i) => !sharedIssues.includes(i))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <GitCompareArrows className="h-5 w-5 text-primary" />
            Run Comparison
          </h2>
          <p className="text-sm text-muted-foreground">
            {runs.length} runs · first selected run is the baseline for deltas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>

      {/* SUS cards with deltas */}
      <div className={cn('grid gap-3', runs.length <= 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4')}>
        {runs.map((run, ri) => {
          const sus = susList[ri]
          const delta = ri === 0 ? null : Math.round((sus.score - baseSus) * 10) / 10
          return (
            <Card key={run.id} style={{ borderTop: `3px solid ${runColor(run, ri)}` }}>
              <CardHeader className="pb-2">
                <CardDescription className="truncate text-xs" title={run.flowName}>
                  {runLabel(run, ri, runs)}
                  {run.mock && ' · mock'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <span
                    className={cn(
                      'text-3xl font-bold tabular-nums',
                      sus.score >= 72 ? 'text-emerald-500' : sus.score >= 52 ? 'text-amber-500' : 'text-destructive'
                    )}
                  >
                    {sus.score}
                  </span>
                  <Badge variant="secondary" className="mb-1">
                    {sus.grade}
                  </Badge>
                  {delta !== null && (
                    <span
                      className={cn(
                        'mb-1 ml-auto flex items-center gap-0.5 text-sm font-semibold tabular-nums',
                        delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-destructive' : 'text-muted-foreground'
                      )}
                    >
                      {delta > 0 ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : delta < 0 ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <Minus className="h-3.5 w-3.5" />
                      )}
                      {Math.abs(delta)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {run.results.length}/{run.stepTexts.length} steps · avg frustration {sus.avgFrustration}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Overlaid frustration curves */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Frustration Curves Overlay</CardTitle>
          <CardDescription>A line ending early means that persona abandoned the flow.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={curveData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="step" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {runs.map((run, ri) => (
                <Line
                  key={run.id}
                  type="monotone"
                  dataKey={`run${ri}`}
                  name={runLabel(run, ri, runs)}
                  stroke={runColor(run, ri)}
                  strokeWidth={2.5}
                  strokeDasharray={
                    runs.findIndex((r) => r.personaId === run.personaId) !== ri ? '6 4' : undefined
                  }
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Interactions vs planned */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Total Interactions vs Planned Steps</CardTitle>
          <CardDescription>How much fumbling each run needed to get (or fail to get) through the flow.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(140, runs.length * 64)}>
            <BarChart data={effData} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                opacity={0.6}
              />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="planned" name="Planned steps" fill="#34d399" radius={[0, 4, 4, 0]} maxBarSize={14} />
              <Bar dataKey="simulated" name="Simulated interactions" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Issue diff */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">UX Issue Diff</CardTitle>
          <CardDescription>
            Shared issues are systemic; issues unique to a run point at persona-specific (or version-specific) friction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sharedIssues.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Shared ({sharedIssues.length})
              </p>
              <ul className="space-y-1">
                {sharedIssues.map((issue) => (
                  <li key={issue} className="rounded-md border bg-muted/20 p-2 text-xs leading-snug">
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={cn('grid gap-4', runs.length <= 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4')}>
            {runs.map((run, ri) => (
              <div key={run.id}>
                <p
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: runColor(run, ri) }} />
                  Only in {runLabel(run, ri, runs)} ({uniqueIssues[ri].length})
                </p>
                {uniqueIssues[ri].length === 0 ? (
                  <p className="text-xs text-muted-foreground">None.</p>
                ) : (
                  <ul className="space-y-1">
                    {uniqueIssues[ri].map((issue) => (
                      <li key={issue} className="rounded-md border bg-muted/20 p-2 text-xs leading-snug">
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          {sharedIssues.length === 0 && uniqueIssues.every((u) => u.length === 0) && (
            <p className="py-2 text-center text-sm text-muted-foreground">No issues flagged in any selected run. 🎉</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
