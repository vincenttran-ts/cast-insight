import { useState } from 'react'
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FlaskConical,
  Loader2,
  Settings2,
  XCircle,
  Zap,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { validateKey } from '@/lib/api'

// Current Gemini lineup for new AI Studio keys (Oct 2026). First entry is the default.
export const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', label: 'gemini-3.8-flash', hint: 'Recommended — best quality per run' },
  { id: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite', hint: 'Fastest, lightest on quota' },
  { id: 'gemini-3.1-pro-preview', label: 'gemini-3.1-pro-preview', hint: 'Deepest analysis (preview, may need billing)' },
]

/**
 * Gemini 1.x/2.0 are shut down and 2.5 is closed to new keys (retiring
 * 2026-10-20). Saved settings pointing at these get moved to the default.
 */
export function isRetiredModel(id: string): boolean {
  return /^gemini-(1\.|2\.0|2\.5)/i.test(id.trim())
}

const CUSTOM_MODEL = '__custom__'

interface SettingsProps {
  apiKey: string
  onApiKeyChange: (key: string) => void
  model: string
  onModelChange: (model: string) => void
  mockMode: boolean
  onMockModeChange: (on: boolean) => void
}

/**
 * Compact header chip summarizing the engine state. Clicking it opens the
 * full settings dialog — the API key itself never appears in the main UI.
 */
export function GatewayStatusChip({
  mockMode,
  apiKey,
  model,
  onClick,
}: {
  mockMode: boolean
  apiKey: string
  model: string
  onClick: () => void
}) {
  const live = !mockMode && apiKey.trim().length > 0
  const missing = !mockMode && apiKey.trim().length === 0

  return (
    <button
      type="button"
      onClick={onClick}
      title="Engine settings"
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        mockMode && 'border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400',
        live && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400',
        missing && 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20'
      )}
    >
      {mockMode ? (
        <>
          <FlaskConical className="h-3.5 w-3.5" />
          Sandbox Mode
        </>
      ) : live ? (
        <>
          <Zap className="h-3.5 w-3.5" />
          Live · {model}
        </>
      ) : (
        <>
          <XCircle className="h-3.5 w-3.5" />
          No API key — click to set up
        </>
      )}
    </button>
  )
}

/**
 * Gemini engine settings, tucked into a dialog so the key stays out of the
 * everyday workspace. Opened from the header gear or the status chip.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  apiKey,
  onApiKeyChange,
  model,
  onModelChange,
  mockMode,
  onMockModeChange,
}: SettingsProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [showKey, setShowKey] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ ok: boolean; error?: string } | null>(null)
  // Custom-model mode sticks when the stored model isn't one of the presets.
  const [customModel, setCustomModel] = useState(() => !GEMINI_MODELS.some((m) => m.id === model))

  const handleValidate = async () => {
    setChecking(true)
    setCheckResult(null)
    const result = await validateKey(apiKey, model)
    setCheckResult(result)
    setChecking(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Engine settings">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Simulation Engine Settings
          </DialogTitle>
          <DialogDescription>
            Configure how persona walkthroughs are evaluated. Most of the team can stay in Sandbox Mode —
            a Gemini key is only needed for live multimodal analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Sandbox first: the zero-setup path */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-start gap-2.5">
              <FlaskConical className="mt-0.5 h-4 w-4 text-amber-500" />
              <div>
                <p className="text-sm font-medium leading-tight">Sandbox Mock Mode</p>
                <p className="text-xs text-muted-foreground">
                  Context-aware simulated results — no API key needed.
                </p>
              </div>
            </div>
            <Switch checked={mockMode} onCheckedChange={onMockModeChange} aria-label="Toggle Sandbox Mock Mode" />
          </div>

          <Separator />

          <div className={cn('space-y-5 transition-opacity', mockMode && 'opacity-50')}>
            <div className="space-y-2">
              <Label htmlFor="gemini-key">Google AI Studio API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="gemini-key"
                    type={showKey ? 'text' : 'password'}
                    placeholder="AQ.…"
                    value={apiKey}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => {
                      onApiKeyChange(e.target.value)
                      setCheckResult(null)
                    }}
                    className="pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                    onClick={() => setShowKey((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button variant="outline" disabled={!apiKey || checking} onClick={handleValidate}>
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
                </Button>
              </div>
              {checkResult && (
                <p
                  className={cn(
                    'flex items-center gap-1.5 text-xs',
                    checkResult.ok ? 'text-emerald-500' : 'text-destructive'
                  )}
                >
                  {checkResult.ok ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Key validated against {model}.
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5" /> {checkResult.error}
                    </>
                  )}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Held in this browser session only and sent per-request via a secure header to the local
                proxy — never stored server-side.
              </p>
              <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Work Gemini vs. API access</p>
                <p className="mt-1.5 leading-relaxed">
                  Gemini in Google Workspace (Gmail, Docs, etc.) is separate from the API key used here.
                  Limits depend on the Google Cloud project behind your key, not your work chat license.
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li>
                    New AI Studio keys start with <span className="font-mono">AQ.</span> — older{' '}
                    <span className="font-mono">AIza</span> keys are no longer accepted by the Gemini API.
                  </li>
                  <li>
                    New keys can't use Gemini 2.5 or older; stick to the 3.x models below.
                  </li>
                  <li>
                    Free-tier keys hit low rate limits quickly during walkthroughs (one call per step).
                  </li>
                  <li>
                    For team usage, create a key from a billed org GCP project with the Generative Language
                    API enabled.
                  </li>
                </ul>
                <p className="mt-2">
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Manage API keys
                  </a>
                  {' · '}
                  <a
                    href="https://aistudio.google.com/rate-limit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Check rate limits
                  </a>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Evaluation Model</Label>
              <Select
                value={customModel ? CUSTOM_MODEL : model}
                onValueChange={(v) => {
                  if (v === CUSTOM_MODEL) {
                    setCustomModel(true)
                  } else {
                    setCustomModel(false)
                    onModelChange(v)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a Gemini model" />
                </SelectTrigger>
                <SelectContent>
                  {GEMINI_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-mono text-xs">{m.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">— {m.hint}</span>
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_MODEL}>
                    <span className="text-xs">Custom model…</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {customModel && (
                <Input
                  placeholder="e.g. gemini-3.7-flash"
                  value={model}
                  spellCheck={false}
                  onChange={(e) => onModelChange(e.target.value)}
                  className="font-mono text-xs"
                  aria-label="Custom model id"
                />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
