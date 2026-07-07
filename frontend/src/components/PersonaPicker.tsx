import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  RotateCcw,
  Settings2,
  UserPlus,
  UserRound,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { PersonaRow } from '@/components/PersonaRow'
import { PersonaCard } from '@/components/PersonaCard'
import { cognitiveAxisLabel } from '@/lib/personaDefaults'
import type { Persona, PersonaTraits } from '@/types'

const TRAIT_META: { key: keyof PersonaTraits; label: string; low: string; high: string }[] = [
  { key: 'techLiteracy', label: 'Tech Literacy', low: 'Anxious', high: 'Power user' },
  { key: 'frustrationThreshold', label: 'Frustration Threshold', low: 'Rage-quits fast', high: 'Patient' },
  { key: 'industryExperience', label: 'Industry Experience', low: 'New to casting', high: 'Veteran' },
]

function formatFetchedAt(iso: string | null) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return null
  }
}

interface PersonaPickerProps {
  roster: Persona[]
  teamPersonas: Persona[]
  teamLoading: boolean
  teamError: string | null
  teamLastFetchedAt: string | null
  onRefreshTeam: () => void
  personaId: string
  onPersonaChange: (id: string) => void
  onPersonaTraitsChange: (id: string, traits: PersonaTraits) => void
  onAddToRoster: (persona: Persona) => void
  onResetDefaults: () => void
  onOpenStudio: (personaId?: string) => void
}

export function PersonaPicker({
  roster,
  teamPersonas,
  teamLoading,
  teamError,
  teamLastFetchedAt,
  onRefreshTeam,
  personaId,
  onPersonaChange,
  onPersonaTraitsChange,
  onAddToRoster,
  onResetDefaults,
  onOpenStudio,
}: PersonaPickerProps) {
  const [search, setSearch] = useState('')
  const [previewExpanded, setPreviewExpanded] = useState(false)

  const active =
    roster.find((p) => p.id === personaId) ??
    teamPersonas.find((p) => p.id === personaId) ??
    roster[0]

  const filteredTeam = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teamPersonas
    return teamPersonas.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.thinkingStyle.archetype.toLowerCase().includes(q) ||
        p.userProfile.identityBullets.some((b) => b.toLowerCase().includes(q))
    )
  }, [teamPersonas, search])

  const summaryLine = active
    ? [
        active.name,
        active.thinkingStyle.archetype,
        active.thinkingStyle.dominantCognitiveAxis
          ? cognitiveAxisLabel(active.thinkingStyle.dominantCognitiveAxis)
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4 text-primary" />
              Persona
            </CardTitle>
            <CardDescription className="mt-1.5">
              Pick a persona and calibrate traits for this walkthrough.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            title="Restore default Talent persona (keeps custom drafts)"
            aria-label="Restore default Talent persona"
            onClick={onResetDefaults}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Input
          placeholder="Search team personas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs"
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Team library</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onRefreshTeam()}
              disabled={teamLoading}
            >
              {teamLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Refresh
            </Button>
          </div>
          {teamError && <p className="text-xs text-destructive">{teamError}</p>}
          {teamLastFetchedAt && (
            <p className="text-[10px] text-muted-foreground">Synced {formatFetchedAt(teamLastFetchedAt)}</p>
          )}
          {teamLoading && filteredTeam.length === 0 ? (
            <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
              Loading team personas…
            </div>
          ) : filteredTeam.length === 0 ? (
            <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
              No team personas yet.
            </div>
          ) : (
            <div className="grid max-h-[160px] gap-2 overflow-y-auto pr-1">
              {filteredTeam.map((p) => (
                <PersonaRow
                  key={p.id}
                  persona={p}
                  selected={p.id === personaId}
                  onSelect={() => onPersonaChange(p.id)}
                  compact
                />
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Session roster</p>
          <div className="grid gap-2">
            {roster.map((p) => (
              <PersonaRow
                key={p.id}
                persona={p}
                selected={p.id === personaId}
                onSelect={() => onPersonaChange(p.id)}
                compact
              />
            ))}
          </div>
        </div>

        {active && !roster.some((p) => p.id === active.id) && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => onAddToRoster(active)}>
            <UserPlus className="h-3.5 w-3.5" />
            Add to roster
          </Button>
        )}

        {active && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div>
              <p className="text-sm font-semibold leading-tight">{active.role}</p>
              <p className="text-xs text-muted-foreground">{summaryLine}</p>
            </div>

            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between text-xs font-medium text-primary"
                onClick={() => setPreviewExpanded((e) => !e)}
              >
                {previewExpanded ? 'Hide persona preview' : 'View full persona'}
                {previewExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {previewExpanded && <PersonaCard persona={active} className="mt-2" />}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Trait calibration
              </p>
              {TRAIT_META.map(({ key, label, low, high }) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{label}</Label>
                    <span className="font-mono text-xs text-primary">{active.traits[key]}</span>
                  </div>
                  <Slider
                    value={[active.traits[key]]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={([v]) => onPersonaTraitsChange(active.id, { ...active.traits, [key]: v })}
                    aria-label={label}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{low}</span>
                    <span>{high}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button variant="outline" className="w-full" onClick={() => onOpenStudio(active?.id)}>
          <Settings2 className="h-4 w-4" />
          Manage personas
        </Button>
      </CardContent>
    </Card>
  )
}
