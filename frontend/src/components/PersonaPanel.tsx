import { useState } from 'react'
import {
  Briefcase,
  Clapperboard,
  Pencil,
  Plus,
  RotateCcw,
  Smartphone,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { blankPersona } from '@/lib/personas'
import { PersonaEditor } from '@/components/PersonaEditor'
import type { Persona, PersonaTraits } from '@/types'

const PERSONA_ICONS: Record<string, typeof UserRound> = {
  'talent-actor': Smartphone,
  'talent-rep': Briefcase,
  'casting-director': Clapperboard,
}

const TRAIT_META: { key: keyof PersonaTraits; label: string; low: string; high: string }[] = [
  { key: 'techLiteracy', label: 'Tech Literacy', low: 'Anxious', high: 'Power user' },
  { key: 'frustrationThreshold', label: 'Frustration Threshold', low: 'Rage-quits fast', high: 'Patient' },
  { key: 'industryExperience', label: 'Industry Experience', low: 'New to casting', high: 'Veteran' },
]

interface PersonaPanelProps {
  personas: Persona[]
  personaId: string
  onPersonaChange: (id: string) => void
  traits: PersonaTraits
  onTraitsChange: (traits: PersonaTraits) => void
  onSavePersona: (persona: Persona) => void
  onDeletePersona: (id: string) => void
  onResetDefaults: () => void
}

export function PersonaPanel({
  personas,
  personaId,
  onPersonaChange,
  traits,
  onTraitsChange,
  onSavePersona,
  onDeletePersona,
  onResetDefaults,
}: PersonaPanelProps) {
  const active = personas.find((p) => p.id === personaId) ?? personas[0]
  const [editing, setEditing] = useState<Persona | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [deleting, setDeleting] = useState<Persona | null>(null)

  const openNew = () => {
    setEditing(blankPersona())
    setIsNew(true)
  }

  const openEdit = (persona: Persona) => {
    setEditing(persona)
    setIsNew(false)
  }

  const handleSave = (persona: Persona) => {
    onSavePersona(persona)
    setEditing(null)
    if (isNew) {
      onPersonaChange(persona.id)
      onTraitsChange({ ...persona.traits })
    } else if (persona.id === personaId) {
      onTraitsChange({ ...persona.traits })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4 text-primary" />
              Persona Engine
            </CardTitle>
            <CardDescription className="mt-1.5">
              Pick a blueprint or build your own, then calibrate traits for this run.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            title="Restore the 3 built-in blueprints to factory settings (keeps your custom personas)"
            aria-label="Restore default personas"
            onClick={onResetDefaults}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2">
          {personas.map((p) => {
            const Icon = p.custom ? Sparkles : (PERSONA_ICONS[p.id] ?? UserRound)
            const selected = p.id === personaId
            return (
              <div
                key={p.id}
                className={cn(
                  'group relative rounded-lg border transition-colors',
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'hover:border-muted-foreground/40 hover:bg-accent'
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    onPersonaChange(p.id)
                    onTraitsChange({ ...p.traits })
                  }}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                      !p.color && (selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')
                    )}
                    style={
                      p.color
                        ? selected
                          ? { backgroundColor: p.color, color: '#fff' }
                          : { backgroundColor: `${p.color}26`, color: p.color }
                        : undefined
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 pr-12">
                    <p className="text-sm font-semibold leading-tight">
                      {p.role}
                      {p.custom && (
                        <Badge variant="outline" className="ml-1.5 rounded-md px-1 py-0 align-middle text-[9px]">
                          custom
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      “{p.name}” · {p.deviceContext}
                    </p>
                    {selected && p.description && (
                      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                  </div>
                </button>

                {/* hover actions */}
                <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title="Edit persona"
                    aria-label={`Edit ${p.role}`}
                    onClick={() => openEdit(p)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {personas.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Delete persona"
                      aria-label={`Delete ${p.role}`}
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          New Persona
        </Button>

        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Trait Calibration · this run
          </p>
          {TRAIT_META.map(({ key, label, low, high }) => (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{label}</Label>
                <span className="font-mono text-xs text-primary">{traits[key]}</span>
              </div>
              <Slider
                value={[traits[key]]}
                min={0}
                max={100}
                step={5}
                onValueChange={([v]) => onTraitsChange({ ...traits, [key]: v })}
                aria-label={label}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{low}</span>
                <span>{high}</span>
              </div>
            </div>
          ))}
        </div>

        {active && active.painPoints.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Known UX Triggers
            </p>
            <div className="flex flex-wrap gap-1.5">
              {active.painPoints.slice(0, 4).map((pp) => (
                <Badge key={pp} variant="outline" className="rounded-md text-[10px] font-normal leading-tight">
                  {pp.length > 64 ? `${pp.slice(0, 64)}…` : pp}
                </Badge>
              ))}
              {active.painPoints.length > 4 && (
                <Badge variant="secondary" className="rounded-md text-[10px]">
                  +{active.painPoints.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        )}

        <PersonaEditor
          persona={editing}
          isNew={isNew}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />

        <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{deleting?.role}”?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleting?.custom
                  ? 'This custom persona will be removed from the roster. Past runs in history keep their results.'
                  : 'This built-in blueprint will be removed — you can bring it back any time with the restore button in the panel header.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (deleting) onDeletePersona(deleting.id)
                  setDeleting(null)
                }}
              >
                Delete persona
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
