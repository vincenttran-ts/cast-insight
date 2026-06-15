import { useEffect, useRef } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeftCircle,
  CheckCircle2,
  DoorOpen,
  Eye,
  Keyboard,
  Loader2,
  MessageSquareQuote,
  MousePointerClick,
  MoveVertical,
  PauseCircle,
  Radio,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { ActionType, SimulationRun, StepResult } from '@/types'

const ACTION_META: Record<ActionType, { icon: typeof MousePointerClick; label: string; className: string }> = {
  click: { icon: MousePointerClick, label: 'CLICK', className: 'bg-primary/15 text-primary border-primary/40' },
  type: { icon: Keyboard, label: 'TYPE', className: 'bg-sky-500/15 text-sky-500 border-sky-500/40' },
  scroll: { icon: MoveVertical, label: 'SCROLL', className: 'bg-muted text-muted-foreground border-border' },
  hesitate: { icon: PauseCircle, label: 'HESITATE', className: 'bg-amber-500/15 text-amber-500 border-amber-500/40' },
  backtrack: { icon: ArrowLeftCircle, label: 'BACK-TRACK', className: 'bg-orange-500/15 text-orange-500 border-orange-500/40' },
  abandon: { icon: DoorOpen, label: 'ABANDON', className: 'bg-destructive/15 text-destructive border-destructive/40' },
  complete: { icon: CheckCircle2, label: 'COMPLETE', className: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40' },
}

interface SimulatorFeedProps {
  run: SimulationRun | null
  /** when provided, the idle state offers a one-click sandbox demo run */
  onDemoRun?: () => void
}

export function SimulatorFeed({ run, onDemoRun }: SimulatorFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Keep the live feed pinned to the newest entry.
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [run?.results.length, run?.status])

  const totalSteps = run?.stepTexts.length ?? 0
  const progress = run && totalSteps > 0 ? Math.min(100, (run.results.length / totalSteps) * 100) : 0

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio
              className={cn('h-4 w-4', run?.status === 'running' ? 'animate-pulse-soft text-red-500' : 'text-primary')}
            />
            Agentic Simulation Tracker
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {run?.batch && (
              <Badge variant="outline" className="gap-1" style={{ borderColor: run.personaColor }}>
                <span className="h-2 w-2 rounded-full" style={{ background: run.personaColor ?? 'hsl(var(--primary))' }} />
                Persona {run.batch.index}/{run.batch.total}
              </Badge>
            )}
            {run && (
              <Badge variant={run.status === 'running' ? 'default' : 'secondary'} className="uppercase tracking-wide">
                {run.status === 'running' ? `Live — step ${Math.min(run.results.length + 1, totalSteps)}/${totalSteps}` : run.status}
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          {run
            ? `${run.personaRole} ("${run.personaName}") walking "${run.flowName}" on ${run.model}${run.mock ? ' · sandbox mock' : ''}`
            : 'Hit "Run AI Simulation" to stream the persona\'s cognitive walkthrough here.'}
        </CardDescription>
        {run && run.status === 'running' && <Progress value={progress} className="h-1.5" />}
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <div ref={scrollRef} className="feed-scroll h-full max-h-[560px] space-y-3 overflow-y-auto pr-1">
          {!run && (
            <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-sm text-muted-foreground">
              <Activity className="h-6 w-6 opacity-40" />
              The feed is idle.
              {onDemoRun && (
                <>
                  <button
                    type="button"
                    onClick={onDemoRun}
                    className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    ▶ Try a demo run
                  </button>
                  <span className="max-w-[260px] text-center text-[11px] leading-snug">
                    Loads the self-tape template with the Actor persona in sandbox mode — no API key needed.
                  </span>
                </>
              )}
            </div>
          )}

          {run?.results.map((result) => <FeedEntry key={result.stepIndex} result={result} />)}

          {run?.status === 'running' && (
            <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {run.results.length < totalSteps
                ? `Persona is examining step ${run.results.length + 1}: “${truncate(run.stepTexts[run.results.length] ?? '', 90)}”`
                : 'Finalizing run…'}
            </div>
          )}

          {run?.status === 'error' && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Simulation halted</p>
                <p className="text-xs opacity-90">{run.error}</p>
              </div>
            </div>
          )}

          {run?.status === 'done' && run.results.some((r) => r.actionType === 'abandon') && (
            <div className="flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <DoorOpen className="h-4 w-4 shrink-0" />
              The persona abandoned the task before completing the flow — see the report for the attrition point.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function FeedEntry({ result }: { result: StepResult }) {
  const meta = ACTION_META[result.actionType]
  const ActionIcon = meta.icon
  const hot = result.frustration > 55

  return (
    <div
      className={cn(
        'animate-in fade-in slide-in-from-bottom-2 rounded-lg border bg-card p-4 duration-300',
        hot && 'border-destructive/40'
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">STEP {result.stepIndex + 1}</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold', hot ? 'text-destructive' : 'text-muted-foreground')}>
            Frustration {result.frustration}/100
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Confidence {result.confidence}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        {/* The User's Eyes */}
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Eye className="h-3 w-3" />
            The User's Eyes
          </p>
          {result.imagePreview ? (
            <img
              src={result.imagePreview}
              alt={`Screen analyzed at step ${result.stepIndex + 1}`}
              className="max-h-40 w-full rounded-md border bg-black/20 object-contain"
            />
          ) : (
            <div className="flex h-24 items-center justify-center rounded-md border border-dashed px-2 text-center text-[10px] leading-snug text-muted-foreground">
              Text-only layout: “{truncate(result.stepText, 80)}”
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {/* Inner Monologue */}
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <MessageSquareQuote className="h-3 w-3" />
              Persona Inner Monologue
            </p>
            <p className="text-sm italic leading-relaxed text-foreground/90">“{result.innerMonologue}”</p>
          </div>

          {/* Action Taken */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Current Action Taken
            </p>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold',
                meta.className
              )}
            >
              <ActionIcon className="h-3.5 w-3.5" />
              {result.action}
            </span>
          </div>

          {result.uxIssues.length > 0 && (
            <ul className="space-y-1">
              {result.uxIssues.map((issue) => (
                <li key={issue} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…` : s
}
