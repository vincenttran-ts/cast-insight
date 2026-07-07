import { useEffect, useState } from 'react'
import { Save, UserRoundPen } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PersonaEditorForm } from '@/components/PersonaEditorForm'
import { clonePersonaDraft, isPersonaComplete, normalizePersonaForSave } from '@/lib/personaDefaults'
import type { Persona } from '@/types'

interface PersonaEditorProps {
  persona: Persona | null
  isNew: boolean
  onSave: (persona: Persona) => void
  onClose: () => void
}

/**
 * Create/edit drawer for personas. Slides in from the right.
 * Prefer Persona Studio for full authoring; this remains for quick sheet edits if needed.
 */
export function PersonaEditor({ persona, isNew, onSave, onClose }: PersonaEditorProps) {
  const [draft, setDraft] = useState<Persona | null>(persona ? clonePersonaDraft(persona) : null)

  useEffect(() => {
    setDraft(persona ? clonePersonaDraft(persona) : null)
  }, [persona])

  const canSave = draft ? isPersonaComplete(draft) : false

  const handleSave = () => {
    if (!draft || !canSave) return
    onSave(normalizePersonaForSave(draft))
  }

  return (
    <Sheet open={Boolean(persona)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            <UserRoundPen className="h-4 w-4 text-primary" />
            {isNew ? 'New Persona' : 'Edit Persona'}
            {draft && !draft.custom && !isNew && (
              <Badge variant="secondary" className="text-[10px]">Built-in blueprint</Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            User persona defines who they are. Thinking style drives how they reason. Walkthrough behavior controls abandon and frustration in sims.
          </SheetDescription>
        </SheetHeader>

        {draft && (
          <>
            <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
              <PersonaEditorForm draft={draft} onChange={setDraft} idPrefix="sheet" />
            </div>

            <SheetFooter className="shrink-0 border-t px-6 py-4">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={!canSave}>
                <Save className="h-4 w-4" />
                {isNew ? 'Create Persona' : 'Save Changes'}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
