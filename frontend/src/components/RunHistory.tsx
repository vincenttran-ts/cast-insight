import { useState } from 'react'
import { Download, Eye, FlaskConical, GitCompareArrows, History, Trash2, Zap } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { computeSus } from '@/lib/metrics'
import { downloadStandaloneReport } from '@/lib/reportExport'
import type { SimulationRun } from '@/types'

const MAX_COMPARE = 4

interface RunHistoryProps {
  history: SimulationRun[]
  onView: (id: string) => void
  onDelete: (id: string) => void
  onCompare: (ids: string[]) => void
}

export function RunHistory({ history, onView, onDelete, onCompare }: RunHistoryProps) {
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length < MAX_COMPARE ? [...prev, id] : prev
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Run History
          </CardTitle>
          <Button
            size="sm"
            disabled={selected.length < 2}
            onClick={() => onCompare(selected)}
            title={selected.length < 2 ? 'Select 2–4 runs to compare' : undefined}
          >
            <GitCompareArrows className="h-4 w-4" />
            Compare {selected.length >= 2 ? `(${selected.length})` : ''}
          </Button>
        </div>
        <CardDescription>
          Every finished run is archived here automatically. Tick 2–{MAX_COMPARE} to compare — redesign
          iterations or personas against each other.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
            <History className="h-5 w-5 opacity-40" />
            No archived runs yet — finish a simulation and it lands here.
          </div>
        ) : (
          <ul className="feed-scroll max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {history.map((run) => {
              const sus = computeSus(run.results)
              const checked = selected.includes(run.id)
              const abandoned = run.results.some((r) => r.actionType === 'abandon')
              return (
                <li
                  key={run.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors',
                    checked && 'border-primary ring-1 ring-primary'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(run.id)}
                    aria-label={`Select run of ${run.flowName} by ${run.personaRole} for comparison`}
                    className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                  />
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: run.personaColor ?? 'hsl(var(--primary))' }}
                    title={run.personaRole}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{run.flowName}</p>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      {run.personaRole}
                      <span>·</span>
                      {new Date(run.startedAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      <span
                        className="inline-flex items-center gap-1"
                        title={run.mock ? 'Sandbox mock run' : `Live run on ${run.model}`}
                      >
                        {run.mock ? <FlaskConical className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                        {run.mock ? 'mock' : run.model}
                      </span>
                      {abandoned && (
                        <Badge variant="destructive" className="px-1.5 py-0 text-[9px]">
                          abandoned
                        </Badge>
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={sus.score >= 72 ? 'default' : sus.score >= 52 ? 'secondary' : 'destructive'}
                    className="shrink-0 font-mono"
                    title={`SUS ${sus.score} — ${sus.label}`}
                  >
                    {sus.score}
                  </Badge>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="View report"
                      aria-label="View this run's report"
                      onClick={() => onView(run.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Export standalone HTML report"
                      aria-label="Export standalone HTML report"
                      onClick={() => downloadStandaloneReport(run)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Delete from history"
                      aria-label="Delete this run from history"
                      onClick={() => {
                        onDelete(run.id)
                        setSelected((prev) => prev.filter((s) => s !== run.id))
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
