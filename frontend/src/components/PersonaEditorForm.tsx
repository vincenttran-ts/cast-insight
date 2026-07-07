import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { PERSONA_COLORS } from '@/lib/personas'
import {
  isPersonaComplete,
  personaCompletenessPercent,
  personaTabComplete,
  PERSONA_EDITOR_TABS,
  type PersonaEditorTab,
} from '@/lib/personaDefaults'
import {
  COGNITIVE_AXIS_OPTIONS,
  INFO_PREFERENCE_OPTIONS,
  THINKING_STYLE_PRESETS,
  presetSelectLabel,
  type ActorSegment,
} from '@/lib/thinkingStylePresets'
import type { CognitiveAxis, InformationProcessingPreference, Persona, PersonaTraits } from '@/types'

const TRAIT_META: { key: keyof PersonaTraits; label: string; low: string; high: string }[] = [
  { key: 'techLiteracy', label: 'Tech Literacy', low: 'Anxious', high: 'Power user' },
  { key: 'frustrationThreshold', label: 'Frustration Threshold', low: 'Rage-quits fast', high: 'Patient' },
  { key: 'industryExperience', label: 'Industry Experience', low: 'New to casting', high: 'Veteran' },
]

const TAB_LABELS: Record<PersonaEditorTab, string> = {
  character: 'Character',
  reactions: 'Reactions',
  calibration: 'Calibration',
}

const TAB_HINTS: Record<PersonaEditorTab, string> = {
  character: 'Add a persona title, two identity bullets, an archetype (not a job title), and two mindset bullets.',
  reactions: 'Describe what frustrates or stops them and how they judge the UI.',
  calibration: 'Optional: tune the trait sliders and advanced cognition dials.',
}

interface PersonaEditorFormProps {
  draft: Persona
  onChange: (persona: Persona) => void
  showCompletenessHeader?: boolean
  idPrefix?: string
  presetSegment?: ActorSegment | 'all'
  /** Controlled active tab; falls back to internal state when omitted. */
  activeTab?: PersonaEditorTab
  onTabChange?: (tab: PersonaEditorTab) => void
  /** Renders a Back/Next footer that walks the tabs in order. */
  guided?: boolean
}

export function PersonaEditorForm({
  draft,
  onChange,
  showCompletenessHeader = true,
  idPrefix = 'p',
  presetSegment = 'all',
  activeTab,
  onTabChange,
  guided = false,
}: PersonaEditorFormProps) {
  const [internalTab, setInternalTab] = useState<PersonaEditorTab>('character')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const tab = activeTab ?? internalTab
  const setTab = (t: PersonaEditorTab) => {
    if (onTabChange) onTabChange(t)
    else setInternalTab(t)
  }

  const tabIndex = PERSONA_EDITOR_TABS.indexOf(tab)
  const isFirstTab = tabIndex <= 0
  const isLastTab = tabIndex >= PERSONA_EDITOR_TABS.length - 1

  const set = (patch: Partial<Persona>) => onChange({ ...draft, ...patch })
  const setStyle = (patch: Partial<Persona['thinkingStyle']>) =>
    onChange({ ...draft, thinkingStyle: { ...draft.thinkingStyle, ...patch } })

  const applyPreset = (presetId: string) => {
    const preset = THINKING_STYLE_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    onChange({
      ...draft,
      thinkingStyle: {
        ...draft.thinkingStyle,
        ...preset.style,
        mindsetBullets: [...preset.style.mindsetBullets],
      },
      frustrationTriggers: [...preset.frustrationTriggers],
      judgmentRules: preset.judgmentRules,
    })
  }

  const filteredPresets = THINKING_STYLE_PRESETS.filter(
    (p) => presetSegment === 'all' || p.segment === 'both' || p.segment === presetSegment
  )

  const pct = personaCompletenessPercent(draft)
  const complete = isPersonaComplete(draft)

  const tabChip = (t: PersonaEditorTab) =>
    personaTabComplete(draft, t) ? (
      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">✓</Badge>
    ) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showCompletenessHeader && (
        <div className="shrink-0 border-b px-1 pb-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {complete ? 'Ready to save' : 'Every field here shapes how the AI plays this persona.'}
            </p>
            <span className="font-mono text-xs font-semibold text-primary">{pct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as PersonaEditorTab)} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mt-3 grid w-full shrink-0 grid-cols-3">
          {PERSONA_EDITOR_TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="text-xs">
              {TAB_LABELS[t]}
              {tabChip(t)}
            </TabsTrigger>
          ))}
        </TabsList>

        {guided && !personaTabComplete(draft, tab) && (
          <p className="mt-2 shrink-0 rounded-md bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            {TAB_HINTS[tab]}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          {/* CHARACTER: who they are + how they think */}
          <TabsContent value="character" className="mt-0 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-role`}>Persona Title *</Label>
                <Input
                  id={`${idPrefix}-role`}
                  placeholder="e.g. The Talent / Actor"
                  value={draft.role}
                  onChange={(e) => set({ role: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-name`}>Display Name</Label>
                <Input
                  id={`${idPrefix}-name`}
                  placeholder='e.g. "Dana Reyes"'
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-identity`}>Who they are (one per line) *</Label>
              <Textarea
                id={`${idPrefix}-identity`}
                rows={3}
                placeholder={'Working actor in her early 50s\nSubmits self-tapes on mobile between auditions'}
                value={draft.userProfile.identityBullets.join('\n')}
                onChange={(e) =>
                  set({
                    userProfile: {
                      ...draft.userProfile,
                      identityBullets: e.target.value.split('\n'),
                    },
                  })
                }
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <Label htmlFor={`${idPrefix}-preset`} className="text-xs">Quick-fill from an actor mindset</Label>
              <Select onValueChange={applyPreset}>
                <SelectTrigger id={`${idPrefix}-preset`} className="h-8 text-xs">
                  <SelectValue placeholder="Choose a preset to pre-fill mindset…" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPresets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {presetSelectLabel(p)} — {p.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-archetype`}>Archetype: why they care *</Label>
              <Input
                id={`${idPrefix}-archetype`}
                placeholder="e.g. Panic Submitter, Brief Purist, Scene-First Actor"
                value={draft.thinkingStyle.archetype}
                onChange={(e) => setStyle({ archetype: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">
                Cognitive motivation, not job title. Shown as &ldquo;{draft.name || 'Name'} is a …&rdquo;
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-mindset`}>How they think (one per line) *</Label>
              <Textarea
                id={`${idPrefix}-mindset`}
                rows={4}
                value={draft.thinkingStyle.mindsetBullets.join('\n')}
                onChange={(e) => setStyle({ mindsetBullets: e.target.value.split('\n') })}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex flex-wrap gap-2">
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
            </div>
          </TabsContent>

          {/* REACTIONS: what frustrates them + how they judge the UI */}
          <TabsContent value="reactions" className="mt-0 space-y-5">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-frustration`}>What frustrates or stops them (one per line) *</Label>
              <p className="text-[10px] text-muted-foreground">
                Drives the frustration score and when the persona abandons the flow.
              </p>
              <Textarea
                id={`${idPrefix}-frustration`}
                rows={5}
                placeholder={'Vague upload progress indicators\nSurprise fees at the last step\nDestructive actions near primary CTAs'}
                value={draft.frustrationTriggers.join('\n')}
                onChange={(e) => set({ frustrationTriggers: e.target.value.split('\n') })}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-judgment`}>How they judge the UI</Label>
              <p className="text-[10px] text-muted-foreground">
                Optional. Preset-filled — the rules the persona applies to every screen.
              </p>
              <Textarea
                id={`${idPrefix}-judgment`}
                rows={5}
                placeholder={'Always: Confirm every irreversible action with explicit feedback\nNever: Trust a spinner without naming what was received'}
                value={draft.judgmentRules}
                onChange={(e) => set({ judgmentRules: e.target.value })}
              />
            </div>
          </TabsContent>

          {/* CALIBRATION: trait sliders + advanced cognition dials */}
          <TabsContent value="calibration" className="mt-0 space-y-5">
            <div className="space-y-4">
              <p className="text-[10px] text-muted-foreground">
                Default trait calibration. Session sliders in the picker override these at run time.
              </p>
              {TRAIT_META.map(({ key, label, low, high }) => (
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
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{low}</span>
                    <span>{high}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium"
                onClick={() => setShowAdvanced((s) => !s)}
              >
                <span>Advanced cognition dials</span>
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showAdvanced && (
                <div className="space-y-4 border-t p-3">
                  <p className="text-[10px] text-muted-foreground">
                    Presets set these. Adjust only for fine-grained control of reasoning style.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`${idPrefix}-axis`}>Cognitive axis</Label>
                      <Select
                        value={draft.thinkingStyle.dominantCognitiveAxis}
                        onValueChange={(v) => setStyle({ dominantCognitiveAxis: v as CognitiveAxis })}
                      >
                        <SelectTrigger id={`${idPrefix}-axis`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COGNITIVE_AXIS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${idPrefix}-info`}>Information preference</Label>
                      <Select
                        value={draft.thinkingStyle.informationProcessingPreference}
                        onValueChange={(v) =>
                          setStyle({ informationProcessingPreference: v as InformationProcessingPreference })
                        }
                      >
                        <SelectTrigger id={`${idPrefix}-info`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INFO_PREFERENCE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Visual continuum</Label>
                      <span className="font-mono text-xs text-primary">
                        {draft.thinkingStyle.visualContinuumPreference}
                      </span>
                    </div>
                    <Slider
                      value={[draft.thinkingStyle.visualContinuumPreference]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={([v]) => setStyle({ visualContinuumPreference: v })}
                      aria-label="Visual continuum preference"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Technical / No-frills</span>
                      <span>Majestic / Immersive</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </div>

        {guided && (
          <div className="flex shrink-0 items-center justify-between border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={isFirstTab}
              onClick={() => setTab(PERSONA_EDITOR_TABS[Math.max(0, tabIndex - 1)])}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            {!isLastTab && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTab(PERSONA_EDITOR_TABS[Math.min(PERSONA_EDITOR_TABS.length - 1, tabIndex + 1)])}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </Tabs>
    </div>
  )
}
