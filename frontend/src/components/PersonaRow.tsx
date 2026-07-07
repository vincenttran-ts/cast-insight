import { Smartphone, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { cognitiveAxisLabel } from '@/lib/personaDefaults'
import type { Persona } from '@/types'

export function personaBadge(persona: Persona) {
  if (persona.shared) return { label: 'team', variant: 'default' as const }
  if (!persona.custom) return { label: 'builtin', variant: 'secondary' as const }
  return { label: 'draft', variant: 'outline' as const }
}

interface PersonaRowProps {
  persona: Persona
  selected: boolean
  onSelect: () => void
  compact?: boolean
}

export function PersonaRow({ persona, selected, onSelect, compact }: PersonaRowProps) {
  const Icon = persona.custom || persona.shared ? Sparkles : Smartphone
  const badge = personaBadge(persona)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/40 hover:bg-accent'
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
          !persona.color && (selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')
        )}
        style={
          persona.color
            ? selected
              ? { backgroundColor: persona.color, color: '#fff' }
              : { backgroundColor: `${persona.color}26`, color: persona.color }
            : undefined
        }
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">
          {persona.role}
          <Badge variant={badge.variant} className="ml-1.5 rounded-md px-1 py-0 align-middle text-[9px]">
            {badge.label}
          </Badge>
        </p>
        <p className={cn('text-muted-foreground', compact ? 'text-[10px] leading-snug' : 'text-xs')}>
          {persona.name}
          {persona.thinkingStyle.archetype ? ` · ${persona.thinkingStyle.archetype}` : ''}
          {!compact && persona.thinkingStyle.dominantCognitiveAxis
            ? ` · ${cognitiveAxisLabel(persona.thinkingStyle.dominantCognitiveAxis)}`
            : ''}
        </p>
      </div>
    </button>
  )
}
