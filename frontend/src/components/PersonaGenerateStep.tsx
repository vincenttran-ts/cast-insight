import { useCallback, useState } from 'react'
import { ArrowLeft, FlaskConical, Loader2, Sparkles, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { PersonaCard } from '@/components/PersonaCard'
import {
  generatePersona,
  type PersonaGenerateInput,
  type PersonaGenerateSource,
} from '@/lib/personaGenerator'
import { cn } from '@/lib/utils'
import type { Persona } from '@/types'

interface PersonaGenerateStepProps {
  mockMode: boolean
  apiKey: string
  model: string
  onUse: (persona: Persona) => void
  onBack: () => void
}

/**
 * PersonAI-style two-pane generator: minimal casting-specific inputs on the
 * left, live PersonaCard preview on the right.
 */
export function PersonaGenerateStep({
  mockMode,
  apiKey,
  model,
  onUse,
  onBack,
}: PersonaGenerateStepProps) {
  const [who, setWho] = useState('')
  const [task, setTask] = useState('')
  const [constraints, setConstraints] = useState('')
  const [generated, setGenerated] = useState<Persona | null>(null)
  const [generatedSource, setGeneratedSource] = useState<PersonaGenerateSource | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canGenerate = who.trim().length > 0 && task.trim().length > 0
  const liveEngine = !mockMode && apiKey.trim().length > 0

  const runGenerate = useCallback(async () => {
    if (!canGenerate) return
    setLoading(true)
    setError(null)
    const input: PersonaGenerateInput = {
      who: who.trim(),
      task: task.trim(),
      constraints: constraints.trim() || undefined,
    }
    try {
      const result = await generatePersona(input, { mockMode, apiKey, model })
      setGenerated(result.persona)
      setGeneratedSource(result.source)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setGenerated(null)
      setGeneratedSource(null)
    } finally {
      setLoading(false)
    }
  }, [canGenerate, who, task, constraints, mockMode, apiKey, model])

  const pullQuote =
    generated?.thinkingStyle.mindsetBullets[0]?.trim() ||
    generated?.judgmentRules.split('\n').find((l) => l.trim())?.replace(/^Always:\s*/i, '')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className="flex min-h-0 flex-col space-y-4">
          <div className="shrink-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Generate with AI
              </h3>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium',
                  mockMode && 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                  liveEngine && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                  !mockMode && !liveEngine && 'border-destructive/40 bg-destructive/10 text-destructive'
                )}
              >
                {mockMode ? (
                  <>
                    <FlaskConical className="h-3 w-3" />
                    Sandbox mock
                  </>
                ) : liveEngine ? (
                  <>
                    <Zap className="h-3 w-3" />
                    Live · {model}
                  </>
                ) : (
                  <>No API key — add one in Settings</>
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Describe who you are testing and what they are trying to do. CastInsight builds a walkthrough-ready
              persona you can refine before saving.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gen-who">Who is this persona? *</Label>
            <Textarea
              id="gen-who"
              rows={3}
              placeholder="Working actor in her 50s who submits self-tapes on mobile between auditions"
              value={who}
              onChange={(e) => setWho(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gen-task">What are they trying to do on Casting Networks? *</Label>
            <Textarea
              id="gen-task"
              rows={3}
              placeholder="Submit a self-tape before the casting deadline and confirm casting received it"
              value={task}
              onChange={(e) => setTask(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gen-constraints">Constraints (optional)</Label>
            <Input
              id="gen-constraints"
              placeholder="Low tech literacy, high deadline stress, mobile-only"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
            />
          </div>

          <Button className="w-full" disabled={!canGenerate || loading} onClick={() => void runGenerate()}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Building persona…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate persona
              </>
            )}
          </Button>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Preview */}
        <div className="flex min-h-0 flex-col rounded-lg border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Generated preview
            </p>
            {generated && generatedSource && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                  generatedSource === 'sandbox'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                )}
              >
                {generatedSource === 'sandbox' ? (
                  <>
                    <FlaskConical className="h-3 w-3" />
                    Heuristic mock
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3" />
                    Generated via Gemini
                  </>
                )}
              </span>
            )}
          </div>
          {generated ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              <PersonaCard persona={generated} eyebrow="Generated preview" />
              {pullQuote && (
                <blockquote className="border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground">
                  &ldquo;{pullQuote}&rdquo;
                </blockquote>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => onUse(generated)}>Use this persona</Button>
                <Button variant="outline" disabled={loading} onClick={() => void runGenerate()}>
                  Regenerate
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              {loading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p>Building persona…</p>
                </>
              ) : (
                <p>Generated persona will appear here</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex shrink-0 gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
    </div>
  )
}
