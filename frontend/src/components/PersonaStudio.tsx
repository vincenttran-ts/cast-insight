import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  CloudUpload,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserRoundPen,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { PersonaEditorForm } from '@/components/PersonaEditorForm'
import { PersonaStartStep } from '@/components/PersonaStartStep'
import { PersonaGenerateStep } from '@/components/PersonaGenerateStep'
import { PersonaCard } from '@/components/PersonaCard'
import { personaFromPreset } from '@/lib/personas'
import {
  clonePersonaDraft,
  isPersonaComplete,
  normalizePersonaForSave,
  personaCompletenessPercent,
  type PersonaEditorTab,
} from '@/lib/personaDefaults'
import type { Persona } from '@/types'

type SegmentFilter = 'all' | 'commercial' | 'film_tv'

interface PersonaStudioProps {
  roster: Persona[]
  teamPersonas: Persona[]
  teamLoading: boolean
  teamError: string | null
  teamLastFetchedAt: string | null
  onRefreshTeam: () => void
  initialPersonaId: string | null
  activePersonaId: string
  onBack: () => void
  onPersonaChange: (id: string) => void
  onSavePersona: (persona: Persona) => void
  onDeletePersona: (id: string) => void
  onForkPersona: (persona: Persona) => Persona
  onPublishPersona: (persona: Persona, authorName?: string) => Promise<void>
  onDeleteTeamPersona: (id: string) => Promise<void>
  mockMode: boolean
  apiKey: string
  model: string
}

function formatFetchedAt(iso: string | null) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return null
  }
}

export function PersonaStudio({
  roster,
  teamPersonas,
  teamLoading,
  teamError,
  teamLastFetchedAt,
  onRefreshTeam,
  initialPersonaId,
  activePersonaId,
  onBack,
  onPersonaChange,
  onSavePersona,
  onDeletePersona,
  onForkPersona,
  onPublishPersona,
  onDeleteTeamPersona,
  mockMode,
  apiKey,
  model,
}: PersonaStudioProps) {
  const [search, setSearch] = useState('')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPersonaId ?? activePersonaId ?? roster[0]?.id ?? null
  )
  const [draft, setDraft] = useState<Persona | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [creating, setCreating] = useState<'choose' | 'generate' | 'edit' | null>(null)
  const [guidedTab, setGuidedTab] = useState<PersonaEditorTab>('character')
  const [deleting, setDeleting] = useState<Persona | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<Persona | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  const allPersonas = useMemo(() => {
    const ids = new Set<string>()
    const merged: Persona[] = []
    for (const p of [...roster, ...teamPersonas]) {
      if (!ids.has(p.id)) {
        ids.add(p.id)
        merged.push(p)
      }
    }
    return merged
  }, [roster, teamPersonas])

  const selectedSource = allPersonas.find((p) => p.id === selectedId) ?? null

  useEffect(() => {
    if (selectedSource) {
      setDraft(clonePersonaDraft(selectedSource))
      setIsNew(false)
    } else if (!isNew) {
      setDraft(null)
    }
  }, [selectedId, selectedSource?.id, selectedSource?.updatedAt, isNew])

  const filteredTeam = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = teamPersonas
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.role.toLowerCase().includes(q) ||
          p.thinkingStyle.archetype.toLowerCase().includes(q)
      )
    }
    return list
  }, [teamPersonas, search])

  const canSave = draft ? isPersonaComplete(draft) : false
  const pct = draft ? personaCompletenessPercent(draft) : 0

  const handleNew = () => {
    setCreating('choose')
    setDraft(null)
    setSelectedId(null)
    setIsNew(false)
    setPublishError(null)
  }

  const handlePickPreset = (presetId: string | 'blank') => {
    const seeded = personaFromPreset(presetId)
    setDraft(clonePersonaDraft(seeded))
    setSelectedId(seeded.id)
    setIsNew(true)
    setCreating('edit')
    setGuidedTab('character')
  }

  const handleStartGenerate = () => {
    setCreating('generate')
    setDraft(null)
    setSelectedId(null)
    setIsNew(false)
    setPublishError(null)
  }

  const handleUseGenerated = (persona: Persona) => {
    setDraft(clonePersonaDraft(persona))
    setSelectedId(persona.id)
    setIsNew(true)
    setCreating('edit')
    setGuidedTab('character')
  }

  const handleCancelNew = () => {
    setCreating(null)
    setDraft(null)
    setIsNew(false)
    setSelectedId(activePersonaId ?? roster[0]?.id ?? null)
  }

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setIsNew(false)
    setCreating(null)
    setPublishError(null)
  }

  const handleSave = () => {
    if (!draft || !canSave) return
    const saved = normalizePersonaForSave(draft)
    onSavePersona(saved)
    setSelectedId(saved.id)
    setIsNew(false)
    setCreating(null)
    onPersonaChange(saved.id)
  }

  const handleFork = () => {
    if (!draft) return
    const source = normalizePersonaForSave(draft)
    const copy = onForkPersona(source)
    setSelectedId(copy.id)
    setIsNew(false)
    setCreating(null)
  }

  const handlePublish = async () => {
    if (!draft || !canSave) {
      setPublishError('Complete all tabs before publishing.')
      return
    }
    setPublishing(true)
    setPublishError(null)
    try {
      const normalized = normalizePersonaForSave(draft)
      onSavePersona(normalized)
      await onPublishPersona(normalized, normalized.authorName || undefined)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  const inRoster = draft ? roster.some((p) => p.id === draft.id) : false
  const isShared = draft?.shared ?? false

  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col">
      <div className="border-b bg-muted/20 px-5 py-3">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to walkthrough
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <UserRoundPen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold">Persona Studio</h2>
          </div>
          {creating || isNew ? (
            <>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <StepChip
                  index={1}
                  label={creating === 'generate' ? 'Generate' : 'Choose style'}
                  active={creating === 'choose' || creating === 'generate'}
                  done={creating === 'edit' || isNew}
                />
                <ChevronRight className="h-3 w-3 opacity-50" />
                <StepChip index={2} label="Fill details" active={creating === 'edit' || isNew} done={false} />
                <ChevronRight className="h-3 w-3 opacity-50" />
                <StepChip index={3} label="Save" active={false} done={false} />
              </div>
              {draft && <span className="ml-auto font-mono text-xs text-primary">{pct}% complete</span>}
            </>
          ) : (
            draft && (
              <>
                <Badge variant="outline" className="text-xs">{draft.role || 'Untitled'}</Badge>
                {!draft.custom && (
                  <Badge variant="secondary" className="text-[10px]">Built-in</Badge>
                )}
                <span className="ml-auto font-mono text-xs text-primary">{pct}% complete</span>
              </>
            )
          )}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1800px] flex-1 grid-cols-1 gap-0 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Persona library: selectable cards; the active card previews live edits */}
        <aside className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
          <div className="shrink-0 space-y-3 border-b p-4">
            <Button variant="outline" size="sm" className="w-full border-dashed" onClick={handleNew}>
              <Plus className="h-3.5 w-3.5" />
              New persona
            </Button>
            <Input
              placeholder="Search team library…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="flex items-center gap-2">
              <Select value={segmentFilter} onValueChange={(v) => setSegmentFilter(v as SegmentFilter)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All segments</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="film_tv">Film & TV</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onRefreshTeam()}
                disabled={teamLoading}
                aria-label="Refresh team library"
              >
                {teamLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {teamError && <p className="text-xs text-destructive">{teamError}</p>}
            {teamLastFetchedAt && (
              <p className="text-[10px] text-muted-foreground">Synced {formatFetchedAt(teamLastFetchedAt)}</p>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {draft && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {isNew ? 'New persona' : 'Editing'}
                </p>
                <PersonaCard persona={draft} eyebrow="Live preview" />
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Team library</p>
              {filteredTeam.length === 0 ? (
                <p className="text-xs text-muted-foreground">No team personas match.</p>
              ) : (
                <div className="grid gap-2">
                  {filteredTeam.map((p) => (
                    <PersonaCard
                      key={p.id}
                      persona={p}
                      dense
                      selected={!isNew && p.id === selectedId}
                      onSelect={() => handleSelect(p.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Session roster</p>
              <div className="grid gap-2">
                {roster.map((p) => (
                  <PersonaCard
                    key={p.id}
                    persona={p}
                    dense
                    selected={!isNew && p.id === selectedId}
                    onSelect={() => handleSelect(p.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Editor pane */}
        <div className="flex min-h-0 min-w-0 flex-col p-4">
          {creating === 'choose' ? (
            <>
              <PersonaStartStep onPick={handlePickPreset} onGenerate={handleStartGenerate} />
              <div className="mt-4 flex shrink-0 gap-2 border-t pt-4">
                <Button variant="ghost" onClick={handleCancelNew}>
                  Cancel
                </Button>
              </div>
            </>
          ) : creating === 'generate' ? (
            <PersonaGenerateStep
              mockMode={mockMode}
              apiKey={apiKey}
              model={model}
              onUse={handleUseGenerated}
              onBack={() => setCreating('choose')}
            />
          ) : draft ? (
            <>
              <PersonaEditorForm
                draft={draft}
                onChange={setDraft}
                idPrefix="studio"
                presetSegment={segmentFilter}
                guided={isNew}
                activeTab={isNew ? guidedTab : undefined}
                onTabChange={isNew ? setGuidedTab : undefined}
              />
              <div className="mt-4 flex shrink-0 flex-wrap gap-2 border-t pt-4">
                <Button onClick={handleSave} disabled={!canSave}>
                  <Save className="h-4 w-4" />
                  {isNew ? 'Create persona' : 'Save changes'}
                </Button>
                {isNew && (
                  <Button variant="ghost" onClick={handleCancelNew}>
                    Cancel
                  </Button>
                )}
                {!isNew && !isShared && (
                  <Button variant="outline" onClick={() => void handlePublish()} disabled={publishing || !canSave}>
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    Publish to team
                  </Button>
                )}
                {!isNew && (
                  <Button variant="outline" onClick={handleFork}>
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </Button>
                )}
                {!isNew && inRoster && roster.length > 1 && (
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleting(draft)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                )}
                {!isNew && isShared && (
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletingTeam(draft)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete team
                  </Button>
                )}
              </div>
              {publishError && <p className="mt-2 shrink-0 text-xs text-destructive">{publishError}</p>}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a persona or create a new one.
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove &ldquo;{deleting?.role}&rdquo; from roster?</AlertDialogTitle>
            <AlertDialogDescription>
              Past runs in history keep their results. Team library copies are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  onDeletePersona(deleting.id)
                  if (selectedId === deleting.id) {
                    setSelectedId(roster.find((p) => p.id !== deleting.id)?.id ?? null)
                    setDraft(null)
                  }
                }
                setDeleting(null)
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deletingTeam)} onOpenChange={(open) => !open && setDeletingTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team persona &ldquo;{deletingTeam?.role}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the persona from the shared library for everyone on the team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deletingTeam) void onDeleteTeamPersona(deletingTeam.id)
                setDeletingTeam(null)
              }}
            >
              Delete from team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StepChip({
  index,
  label,
  active,
  done,
}: {
  index: number
  label: string
  active: boolean
  done: boolean
}) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-full px-2 py-0.5',
        active ? 'bg-primary/15 text-primary' : done ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full font-mono text-[9px]',
          active ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {index}
      </span>
      {label}
    </span>
  )
}
