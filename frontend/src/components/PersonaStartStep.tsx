import { useState } from 'react'
import { PenLine, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { cognitiveAxisLabel, infoPreferenceLabel } from '@/lib/personaDefaults'
import {
  ACTOR_SEGMENT_LABELS,
  THINKING_STYLE_PRESETS,
  type ActorSegment,
} from '@/lib/thinkingStylePresets'

type SegmentFilter = 'all' | ActorSegment

const SEGMENT_TABS: { value: SegmentFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'commercial', label: ACTOR_SEGMENT_LABELS.commercial },
  { value: 'film_tv', label: ACTOR_SEGMENT_LABELS.film_tv },
]

interface PersonaStartStepProps {
  onPick: (presetId: string | 'blank') => void
}

/**
 * Preset-first entry point for creating a persona. Designers pick a curated
 * actor thinking style (or start blank) so the editor opens pre-filled.
 */
export function PersonaStartStep({ onPick }: PersonaStartStepProps) {
  const [segment, setSegment] = useState<SegmentFilter>('all')

  const presets = THINKING_STYLE_PRESETS.filter(
    (p) => segment === 'all' || p.segment === 'both' || p.segment === segment
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-1 pb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Start from an actor mindset
        </h3>
        <p className="text-xs text-muted-foreground">
          Pick a curated thinking style to pre-fill the persona, then tune the details. You can also start from scratch.
        </p>
      </div>

      <div className="mb-3 flex shrink-0 flex-wrap gap-1.5">
        {SEGMENT_TABS.map((t) => (
          <Button
            key={t.value}
            variant={segment === t.value ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setSegment(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPick(preset.id)}
              className={cn(
                'flex h-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors',
                'hover:border-primary/60 hover:bg-accent'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-tight">{preset.label}</p>
                <Badge variant="secondary" className="shrink-0 text-[9px]">
                  {ACTOR_SEGMENT_LABELS[preset.segment]}
                </Badge>
              </div>
              <p className="text-xs leading-snug text-muted-foreground">{preset.description}</p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                  {cognitiveAxisLabel(preset.style.dominantCognitiveAxis)}
                </span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                  {infoPreferenceLabel(preset.style.informationProcessingPreference)}
                </span>
              </div>
            </button>
          ))}

          <button
            type="button"
            onClick={() => onPick('blank')}
            className={cn(
              'flex h-full min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-center transition-colors',
              'hover:border-primary/60 hover:bg-accent'
            )}
          >
            <PenLine className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-semibold leading-tight">Start from scratch</p>
            <p className="text-xs leading-snug text-muted-foreground">
              Build a persona field by field
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
