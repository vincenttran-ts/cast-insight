import { Play, UserRound } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PersonaCard } from '@/components/PersonaCard'
import type { Persona } from '@/types'

interface PersonaBriefingDialogProps {
  persona: Persona | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  batchCount?: number
  onEditInStudio?: () => void
}

/**
 * Pre-run briefing so designers confirm persona motivations before simulating.
 */
export function PersonaBriefingDialog({
  persona,
  open,
  onOpenChange,
  onConfirm,
  batchCount,
  onEditInStudio,
}: PersonaBriefingDialogProps) {
  if (!persona) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" />
            Persona briefing
          </DialogTitle>
          <DialogDescription>
            {batchCount && batchCount > 1
              ? `Running ${batchCount} personas — first up: ${persona.name}`
              : `Confirm how ${persona.name} will approach this walkthrough.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="font-semibold">{persona.role}</p>
          <PersonaCard persona={persona} />
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px]">Tech {persona.traits.techLiteracy}</Badge>
            <Badge variant="outline" className="text-[10px]">Threshold {persona.traits.frustrationThreshold}</Badge>
            <Badge variant="outline" className="text-[10px]">Industry {persona.traits.industryExperience}</Badge>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {onEditInStudio && (
            <Button variant="ghost" size="sm" className="mr-auto" onClick={onEditInStudio}>
              Edit in Studio
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm}>
            <Play className="h-4 w-4" />
            Start simulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
