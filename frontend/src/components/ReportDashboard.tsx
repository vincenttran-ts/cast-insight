import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  Download,
  FileWarning,
  Gauge,
  History,
  TrendingUp,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  abandonStep,
  collectUxIssues,
  computeSus,
  efficiencyBars,
  frustrationCurve,
  totalSimulatedSteps,
} from '@/lib/metrics'
import { downloadStandaloneReport } from '@/lib/reportExport'
import type { SimulationRun } from '@/types'

interface ReportDashboardProps {
  run: SimulationRun | null
  /** true when showing an archived run from history rather than the live one */
  isHistorical?: boolean
}

export function ReportDashboard({ run, isHistorical }: ReportDashboardProps) {
  if (!run || (run.status !== 'done' && run.status !== 'aborted') || run.results.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <BarChart3 className="h-7 w-7 opacity-40" />
          Analytics render here once a simulation run completes.
        </CardContent>
      </Card>
    )
  }

  const sus = computeSus(run.results)
  const curve = frustrationCurve(run.results)
  const bars = efficiencyBars(run.results)
  const issues = collectUxIssues(run)
  const attempted = run.results.length
  const planned = run.stepTexts.length
  const simulated = totalSimulatedSteps(run.results)
  const attrition = abandonStep(run.results)

  const susTone =
    sus.score >= 72 ? 'text-emerald-500' : sus.score >= 52 ? 'text-amber-500' : 'text-destructive'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Gauge className="h-5 w-5 text-primary" />
            Visual Metrics Report
          </h2>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {run.flowName} · {run.personaRole}
            {run.mock && ' · sandbox mock data'}
            {isHistorical && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <History className="h-3 w-3" />
                archived run · {new Date(run.startedAt).toLocaleString()}
              </Badge>
            )}
          </p>
        </div>
        <Button onClick={() => downloadStandaloneReport(run)}>
          <Download className="h-4 w-4" />
          Export Interactive Report
        </Button>
      </div>

      {/* SUS metric card + headline numbers */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="sm:col-span-2 ring-1 ring-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">
              System Usability Scale
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <span className={cn('text-5xl font-bold tabular-nums', susTone)}>{sus.score}</span>
              <div className="pb-1">
                <Badge
                  variant={sus.score >= 72 ? 'default' : sus.score >= 52 ? 'secondary' : 'destructive'}
                  className="mb-1 text-sm"
                >
                  Grade {sus.grade}
                </Badge>
                <p className="text-xs text-muted-foreground">{sus.label}</p>
              </div>
            </div>
            <Separator className="my-3" />
            <p className="text-xs text-muted-foreground">
              Synthesized from completion ({sus.completionRate}%), path efficiency ({sus.efficiencyRatio}),
              and inverse frustration ({sus.avgFrustration}/100). Benchmark average is 68.
            </p>
          </CardContent>
        </Card>

        <MetricCard
          label="Avg Frustration"
          value={`${sus.avgFrustration}/100`}
          hint="persona confusion index"
          tone={sus.avgFrustration > 55 ? 'bad' : 'neutral'}
        />
        <MetricCard
          label="Step Efficiency"
          value={`${attempted}/${planned} steps`}
          hint={
            attempted < planned
              ? `abandoned at step ${attrition ?? attempted} · ${simulated} interactions spent`
              : `all steps reached · ${simulated} interactions (optimal ${planned})`
          }
          tone={attempted < planned || simulated > planned * 1.5 ? 'bad' : 'neutral'}
        />
      </div>

      {/* Frustration Curve */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-destructive" />
            Frustration Curve
          </CardTitle>
          <CardDescription>
            Confusion index (1–100) across consecutive layout steps. The shaded band marks the attrition
            danger zone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={curve} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="step" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'hsl(var(--popover-foreground))',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceArea y1={70} y2={100} fill="hsl(var(--destructive))" fillOpacity={0.07} />
              {attrition && (
                <ReferenceLine
                  x={`Step ${attrition}`}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="4 3"
                  label={{ value: 'abandoned', position: 'top', fontSize: 11, fill: 'hsl(var(--destructive))' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="frustration"
                name="Frustration"
                stroke="hsl(var(--destructive))"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="confidence"
                name="Confidence"
                stroke="#34d399"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Efficiency Bars */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            Efficiency Metrics — Optimal vs. AI Simulated Step Count
          </CardTitle>
          <CardDescription>
            Simulated bars taller than the optimal baseline reveal loops, back-tracking, or lost states at
            that step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bars} margin={{ top: 8, right: 16, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="step" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'hsl(var(--popover-foreground))',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {attrition && (
                <ReferenceLine
                  x={`Step ${attrition}`}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="4 3"
                  label={{ value: 'abandoned', position: 'top', fontSize: 11, fill: 'hsl(var(--destructive))' }}
                />
              )}
              <Bar dataKey="optimal" name="Optimal Path" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={34} />
              <Bar
                dataKey="simulated"
                name="AI Simulated"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* UX issue register */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileWarning className="h-4 w-4 text-amber-500" />
                Flagged UX Issues ({issues.length})
              </CardTitle>
              <CardDescription className="mt-1.5">
                Actionable findings surfaced by the persona, ordered by flow step.
              </CardDescription>
            </div>
            {issues.length > 0 && <CopyIssuesButton run={run} />}
          </div>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No issues flagged in this run. 🎉
            </p>
          ) : (
            <ul className="space-y-2">
              {issues.map(({ step, issue }, i) => (
                <li key={`${step}-${i}`} className="flex items-start gap-2.5 rounded-md border bg-muted/20 p-2.5 text-sm">
                  <Badge variant="outline" className="mt-0.5 shrink-0 rounded-md font-mono text-[10px]">
                    S{step}
                  </Badge>
                  <span className="leading-snug">{issue}</span>
                  <AlertTriangle className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CopyIssuesButton({ run }: { run: SimulationRun }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const lines = run.results.flatMap((r) =>
      r.uxIssues.map((issue) => `- [S${r.stepIndex + 1}] ${issue} (frustration ${r.frustration}/100)`)
    )
    const md = [`## UX Issues — ${run.flowName} (${run.personaRole})`, '', ...lines].join('\n')
    try {
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable (permissions) — button simply stays unchanged */
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copy} className="shrink-0">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy as Markdown'}
    </Button>
  )
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone: 'neutral' | 'bad'
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-widest">{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className={cn('text-3xl font-bold tabular-nums', tone === 'bad' ? 'text-destructive' : '')}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
