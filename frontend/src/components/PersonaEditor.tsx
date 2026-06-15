import { useEffect, useState } from 'react'
import { Save, UserRoundPen } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { PERSONA_COLORS } from '@/lib/personas'
import type { Persona, PersonaTraits } from '@/types'

const TRAIT_META: { key: keyof PersonaTraits; label: string }[] = [
  { key: 'techLiteracy', label: 'Tech Literacy' },
  { key: 'frustrationThreshold', label: 'Frustration Threshold' },
  { key: 'industryExperience', label: 'Industry Experience' },
]

interface PersonaEditorProps {
  /** Persona being edited; null while the dialog is closed */
  persona: Persona | null
  isNew: boolean
  onSave: (persona: Persona) => void
  onClose: () => void
}

/**
 * Create/edit dialog for personas. Pain points are entered one per line —
 * they feed both the Gemini system prompt and the sandbox mock engine's
 * context matching, so concrete, keyword-rich lines give better runs.
 */
export function PersonaEditor({ persona, isNew, onSave, onClose }: PersonaEditorProps) {
  const [draft, setDraft] = useState<Persona | null>(persona)

  // Re-seed the form whenever a different persona is opened.
  useEffect(() => {
    setDraft(persona ? { ...persona, traits: { ...persona.traits }, painPoints: [...persona.painPoints] } : null)
  }, [persona])

  if (!draft) {
    return null
  }

  const set = (patch: Partial<Persona>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const canSave = draft.role.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    onSave({
      ...draft,
      role: draft.role.trim(),
      name: draft.name.trim() || 'Unnamed',
      deviceContext: draft.deviceContext.trim() || 'Unspecified device context',
      description: draft.description.trim(),
      painPoints: draft.painPoints.map((p) => p.trim()).filter(Boolean),
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundPen className="h-4 w-4 text-primary" />
            {isNew ? 'New Persona' : `Edit Persona`}
            {!draft.custom && !isNew && (
              <Badge variant="secondary" className="text-[10px]">
                Built-in blueprint
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Everything here feeds the agent's system prompt, so write it the way you'd brief a real
            usability participant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-role">Persona Title *</Label>
              <Input
                id="p-role"
                placeholder="e.g. The Background Performer"
                value={draft.role}
                onChange={(e) => set({ role: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-name">Display Name</Label>
              <Input
                id="p-name"
                placeholder='e.g. "Jules Park"'
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Accent Color</Label>
            <div className="flex gap-2">
              {PERSONA_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Accent color ${c}`}
                  onClick={() => set({ color: c })}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                    draft.color === c ? 'border-foreground' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Used to identify this persona in the feed, history, and comparison charts.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-device">Device / Usage Context</Label>
            <Input
              id="p-device"
              placeholder="e.g. Older Android tablet, shared family wifi"
              value={draft.deviceContext}
              onChange={(e) => set({ deviceContext: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-desc">Background & Mindset</Label>
            <Textarea
              id="p-desc"
              rows={3}
              placeholder="Who are they, how do they behave under pressure, what do they assume about casting tools…"
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-pains">Known UX Triggers / Pain Points (one per line)</Label>
            <Textarea
              id="p-pains"
              rows={5}
              placeholder={'Vague upload progress indicators\nSurprise fees revealed at the last step\nTiny tap targets near destructive actions'}
              value={draft.painPoints.join('\n')}
              onChange={(e) => set({ painPoints: e.target.value.split('\n') })}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Concrete, keyword-rich lines work best — the simulator matches these against each flow step.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Default Trait Calibration
            </p>
            {TRAIT_META.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{label}</Label>
                  <span className="font-mono text-xs text-primary">{draft.traits[key]}</span>
                </div>
                <Slider
                  value={[draft.traits[key]]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => set({ traits: { ...draft.traits, [key]: v } })}
                  aria-label={label}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            <Save className="h-4 w-4" />
            {isNew ? 'Create Persona' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
