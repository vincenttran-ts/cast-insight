import { cn } from '@/lib/utils'
import {
  cognitiveAxisLabel,
  infoPreferenceLabel,
  thinkingStyleHeadline,
} from '@/lib/personaDefaults'
import type { Persona } from '@/types'

interface PersonaCardProps {
  persona: Persona
  className?: string
  /** Renders as a clickable library entry when provided. */
  onSelect?: () => void
  selected?: boolean
  /** Small label above the headline, e.g. "Editing now". */
  eyebrow?: string
  /** Hide the identity/mindset bullets for a denser list row. */
  dense?: boolean
}

function Bullets({ label, items }: { label: string; items: string[] }) {
  const clean = items.map((i) => i.trim()).filter(Boolean)
  if (clean.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <ul className="space-y-1 text-xs leading-relaxed text-foreground/90">
        {clean.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-60" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Single briefing card fusing thinking style + user persona. Used as the
 * pre-run briefing, the Studio library entry, and the picker preview.
 */
export function PersonaCard({ persona, className, onSelect, selected, eyebrow, dense }: PersonaCardProps) {
  const accent = persona.color ?? '#8b5cf6'
  const style = persona.thinkingStyle
  const visual = style.visualContinuumPreference

  const inner = (
    <>
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} aria-hidden />
      <div className="space-y-3 p-4 text-left">
        <div className="space-y-0.5">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
          )}
          <h3 className="text-sm font-semibold leading-snug">{thinkingStyleHeadline(persona)}</h3>
          <p className="text-xs text-muted-foreground">
            {persona.role || 'Untitled'}
            {persona.name ? ` · ${persona.name}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            {cognitiveAxisLabel(style.dominantCognitiveAxis)}
          </span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            {infoPreferenceLabel(style.informationProcessingPreference)}
          </span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            Visual {visual} · {visual < 40 ? 'Technical' : visual > 70 ? 'Immersive' : 'Balanced'}
          </span>
        </div>

        {!dense && (
          <>
            <Bullets label="How they think" items={style.mindsetBullets} />
            <Bullets label="Who they are" items={persona.userProfile.identityBullets} />
          </>
        )}
      </div>
    </>
  )

  const base = 'overflow-hidden rounded-lg border bg-card shadow-sm'

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          base,
          'w-full transition-colors hover:border-muted-foreground/40',
          selected && 'border-primary ring-1 ring-primary',
          className
        )}
      >
        {inner}
      </button>
    )
  }

  return <article className={cn(base, className)}>{inner}</article>
}
