import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  Clapperboard,
  Download,
  Maximize2,
  Minimize2,
  Moon,
  Play,
  Square,
  Sun,
  Upload,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SettingsDialog, GatewayStatusChip, GEMINI_MODELS } from '@/components/SettingsPanel'
import { PersonaPanel } from '@/components/PersonaPanel'
import { DesignCanvas } from '@/components/DesignCanvas'
import { SimulatorFeed } from '@/components/SimulatorFeed'
import { ReportDashboard } from '@/components/ReportDashboard'
import { RunHistory } from '@/components/RunHistory'
import { RunComparison } from '@/components/RunComparison'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useIdbState } from '@/hooks/useIdbState'
import { useSimulation } from '@/hooks/useSimulation'
import { PERSONAS, factoryPersona, DEFAULT_PERSONA_IDS } from '@/lib/personas'
import { FLOW_TEMPLATES } from '@/lib/templates'
import { cn } from '@/lib/utils'
import type { AppConfig, FlowStep, Persona, PersonaTraits, SavedFlow, SimulationRun } from '@/types'

const SESSION_KEY_STORAGE = 'castinsight.geminiKey'

export default function App() {
  /* ---------- theme ---------- */
  const [dark, setDark] = useLocalStorage('castinsight.dark', true)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  /* ---------- Gemini gateway state (key in session memory only) ---------- */
  const [apiKey, setApiKey] = useState<string>(() => sessionStorage.getItem(SESSION_KEY_STORAGE) ?? '')
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY_STORAGE, apiKey)
    } catch {
      /* session-only convenience; safe to skip */
    }
  }, [apiKey])

  const [model, setModel] = useLocalStorage('castinsight.model', GEMINI_MODELS[0].id)
  const [mockMode, setMockMode] = useLocalStorage('castinsight.mockMode', true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  /* ---------- personas (built-in blueprints + team-created) ---------- */
  const [personas, setPersonas] = useLocalStorage<Persona[]>('castinsight.personas', PERSONAS)
  const [personaId, setPersonaId] = useLocalStorage('castinsight.personaId', PERSONAS[0].id)
  const [traits, setTraits] = useLocalStorage<PersonaTraits>('castinsight.traits', { ...PERSONAS[0].traits })

  // Keep the selection valid if the active persona was deleted.
  useEffect(() => {
    if (personas.length > 0 && !personas.some((p) => p.id === personaId)) {
      setPersonaId(personas[0].id)
      setTraits({ ...personas[0].traits })
    }
  }, [personas, personaId, setPersonaId, setTraits])

  const savePersona = (persona: Persona) => {
    setPersonas((prev) => {
      const exists = prev.some((p) => p.id === persona.id)
      return exists ? prev.map((p) => (p.id === persona.id ? persona : p)) : [...prev, persona]
    })
  }

  const deletePersona = (id: string) => {
    setPersonas((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev))
  }

  const resetDefaultPersonas = () => {
    setPersonas((prev) => {
      const customs = prev.filter((p) => !DEFAULT_PERSONA_IDS.includes(p.id) && p.custom)
      const factory = DEFAULT_PERSONA_IDS.map((id) => factoryPersona(id)!)
      return [...factory, ...customs]
    })
  }

  /* ---------- flow (steps carry screenshots → IndexedDB, no 5MB ceiling) ---------- */
  const [flowName, setFlowName] = useLocalStorage('castinsight.flowName', '')
  const [taskGoal, setTaskGoal] = useLocalStorage('castinsight.taskGoal', '')
  const [steps, setSteps] = useIdbState<FlowStep[]>('castinsight.steps', [])

  /* ---------- saved flow library ---------- */
  const [savedFlows, setSavedFlows] = useIdbState<SavedFlow[]>('castinsight.savedFlows', [])

  /**
   * Saves the current canvas to the library. Without `overwrite`, a name
   * already in the library returns 'name-collision' so the canvas can ask
   * via AlertDialog before replacing it.
   */
  const saveCurrentFlow = (overwrite = false): { id: string } | 'name-collision' | null => {
    const name = flowName.trim()
    if (!name) return null // the save button is disabled without a name
    const existing = savedFlows.find((f) => f.name.toLowerCase() === name.toLowerCase())
    if (existing && !overwrite) return 'name-collision'
    const flow: SavedFlow = {
      id: existing?.id ?? `flow-${Date.now()}`,
      name,
      taskGoal,
      steps: steps.map((s) => ({ ...s, image: s.image ? { ...s.image } : undefined })),
      savedAt: new Date().toISOString(),
    }
    setSavedFlows((prev) => (existing ? prev.map((f) => (f.id === flow.id ? flow : f)) : [...prev, flow]))
    return { id: flow.id }
  }

  const deleteSavedFlow = (id: string) => {
    setSavedFlows((prev) => prev.filter((f) => f.id !== id))
  }

  /* ---------- run history (auto-archived, IndexedDB) ---------- */
  const [runHistory, setRunHistory] = useIdbState<SimulationRun[]>('castinsight.runHistory', [])
  const archiveRun = useCallback(
    (finished: SimulationRun) => setRunHistory((prev) => [finished, ...prev].slice(0, 50)),
    [setRunHistory]
  )

  /* ---------- simulation ---------- */
  const { run, start, startBatch, abort, clear } = useSimulation(archiveRun)
  const [activeTab, setActiveTab] = useState('feed')
  const [viewedRunId, setViewedRunId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const running = run?.status === 'running'

  const viewedRun = viewedRunId ? (runHistory.find((r) => r.id === viewedRunId) ?? null) : null
  const compareRuns = compareIds
    .map((id) => runHistory.find((r) => r.id === id))
    .filter((r): r is SimulationRun => Boolean(r))

  // Jump to the report the moment a run finishes (but not between batch legs).
  const prevStatus = useRef(run?.status)
  useEffect(() => {
    const finished = prevStatus.current === 'running' && (run?.status === 'done' || run?.status === 'aborted')
    const midBatch = run?.batch && run.batch.index < run.batch.total
    if (finished && !midBatch) {
      setActiveTab('report')
    }
    prevStatus.current = run?.status
  }, [run?.status, run?.batch])

  const persona = useMemo(() => {
    const base = personas.find((p) => p.id === personaId) ?? personas[0] ?? PERSONAS[0]
    return { ...base, traits: { ...traits } }
  }, [personas, personaId, traits])

  const validSteps = steps.filter((s) => s.text.trim().length > 0)
  const canRun = validSteps.length > 0 && (mockMode || apiKey.trim().length > 0) && !running

  const runOptions = () => ({
    steps: validSteps,
    flowName: flowName.trim() || 'Untitled flow',
    taskGoal: taskGoal.trim() || validSteps.map((s) => s.text).join(' → '),
    model,
    mockMode,
    apiKey: apiKey.trim(),
  })

  const prepareRun = () => {
    clear()
    setViewedRunId(null)
    setCompareIds([])
    setActiveTab('feed')
  }

  const handleRun = () => {
    prepareRun()
    void start({ persona, ...runOptions() })
  }

  const handleBatchRun = async () => {
    prepareRun()
    const finished = await startBatch(
      personas.map((p) => (p.id === personaId ? persona : p)), // selected persona keeps its live trait overrides
      runOptions()
    )
    if (finished.length >= 2) {
      setCompareIds(finished.map((r) => r.id))
    }
  }

  /** One-click on-ramp: load the self-tape template + actor blueprint in sandbox mode and run it. */
  const handleDemoRun = () => {
    const tpl = FLOW_TEMPLATES[0]
    const demoPersona = factoryPersona('talent-actor') ?? PERSONAS[0]
    const demoSteps: FlowStep[] = tpl.steps.map((s, i) => ({ ...s, id: `demo-${Date.now()}-${i}` }))

    setPersonaId(demoPersona.id)
    setTraits({ ...demoPersona.traits })
    setMockMode(true)
    setFlowName(tpl.name)
    setTaskGoal(tpl.taskGoal)
    setSteps(demoSteps)

    prepareRun()
    void start({
      persona: demoPersona,
      steps: demoSteps,
      flowName: tpl.name,
      taskGoal: tpl.taskGoal,
      model,
      mockMode: true,
      apiKey: apiKey.trim(),
    })
  }

  /* ---------- full-width report mode ---------- */
  const [expanded, setExpanded] = useState(false)

  /* ---------- config import / export ---------- */
  const importInput = useRef<HTMLInputElement>(null)

  const exportConfig = () => {
    const config: AppConfig = { personaId, traits, flowName, taskGoal, steps, model, mockMode, personas, savedFlows }
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'castinsight-config.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importConfig = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const config = JSON.parse(String(reader.result)) as Partial<AppConfig>
        const roster = Array.isArray(config.personas) && config.personas.length > 0 ? config.personas : null
        if (roster) setPersonas(roster)
        if (Array.isArray(config.savedFlows)) setSavedFlows(config.savedFlows)
        const knownIds = (roster ?? personas).map((p) => p.id)
        if (config.personaId && knownIds.includes(config.personaId)) setPersonaId(config.personaId)
        if (config.traits) setTraits(config.traits)
        if (typeof config.flowName === 'string') setFlowName(config.flowName)
        if (typeof config.taskGoal === 'string') setTaskGoal(config.taskGoal)
        if (Array.isArray(config.steps)) setSteps(config.steps)
        if (config.model && GEMINI_MODELS.some((m) => m.id === config.model)) setModel(config.model)
        if (typeof config.mockMode === 'boolean') setMockMode(config.mockMode)
      } catch {
        window.alert('That file is not a valid CastInsight config JSON.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] items-center gap-2 px-5 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Clapperboard className="h-5 w-5" />
          </div>
          <div className="mr-auto">
            <h1 className="text-sm font-bold leading-tight tracking-tight">CastInsight</h1>
            <p className="text-xs text-muted-foreground">Synthetic User Testing · Casting Networks</p>
          </div>

          <GatewayStatusChip
            mockMode={mockMode}
            apiKey={apiKey}
            model={model}
            onClick={() => setSettingsOpen(true)}
          />

          <SettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            model={model}
            onModelChange={setModel}
            mockMode={mockMode}
            onMockModeChange={setMockMode}
          />

          <input
            ref={importInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importConfig(file)
              e.target.value = ''
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            title="Load config JSON"
            aria-label="Load config JSON"
            onClick={() => importInput.current?.click()}
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Save config JSON"
            aria-label="Save config JSON"
            onClick={exportConfig}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle dark mode"
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {running ? (
            <Button variant="destructive" onClick={abort}>
              <Square className="h-4 w-4" />
              {run?.batch ? `Stop Batch (${run.batch.index}/${run.batch.total})` : 'Stop Run'}
            </Button>
          ) : (
            <div className="flex">
              <Button onClick={handleRun} disabled={!canRun} className="rounded-r-none">
                <Play className="h-4 w-4" />
                Run AI Simulation
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={!canRun}
                    className="rounded-l-none border-l border-primary-foreground/20 px-2"
                    aria-label="More run options"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleRun}>
                    <Play />
                    Run selected persona
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleBatchRun()}>
                    <Users />
                    Run all personas ({personas.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </header>

      {/* 3-column workspace: who → what → results (collapsible to full-width results) */}
      <main
        className={cn(
          'mx-auto grid max-w-[1800px] items-start gap-5 px-5 py-5',
          !expanded && 'xl:grid-cols-[340px_minmax(0,1fr)_minmax(0,1.15fr)]'
        )}
      >
        <section aria-label="Persona" className={cn(expanded && 'hidden')}>
          <ColumnHeading step={1} title="Pick the persona" />
          <PersonaPanel
            personas={personas}
            personaId={personaId}
            onPersonaChange={setPersonaId}
            traits={traits}
            onTraitsChange={setTraits}
            onSavePersona={savePersona}
            onDeletePersona={deletePersona}
            onResetDefaults={resetDefaultPersonas}
          />
        </section>

        <section aria-label="User flow" className={cn('min-w-0', expanded && 'hidden')}>
          <ColumnHeading step={2} title="Define the flow" />
          <DesignCanvas
            flowName={flowName}
            onFlowNameChange={setFlowName}
            taskGoal={taskGoal}
            onTaskGoalChange={setTaskGoal}
            steps={steps}
            onStepsChange={setSteps}
            savedFlows={savedFlows}
            onSaveFlow={saveCurrentFlow}
            onDeleteFlow={deleteSavedFlow}
            disabled={running}
          />
        </section>

        <section aria-label="Results" className="min-w-0">
          <div className="flex items-center justify-between">
            <ColumnHeading step={3} title="Watch the walkthrough" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              title={expanded ? 'Back to 3-column workspace' : 'Expand results to full width'}
              aria-label={expanded ? 'Collapse results' : 'Expand results to full width'}
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {compareRuns.length >= 2 ? (
            <RunComparison runs={compareRuns} onClose={() => setCompareIds([])} />
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="feed">Feed</TabsTrigger>
                <TabsTrigger value="report">
                  Report
                  {(run?.status === 'done' || run?.status === 'aborted') && run.results.length > 0 && (
                    <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="history">
                  History
                  {runHistory.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                      {runHistory.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="feed">
                <SimulatorFeed run={run} onDemoRun={running ? undefined : handleDemoRun} />
              </TabsContent>
              <TabsContent value="report">
                <ReportDashboard run={viewedRun ?? run} isHistorical={Boolean(viewedRun)} />
              </TabsContent>
              <TabsContent value="history">
                <RunHistory
                  history={runHistory}
                  onView={(id) => {
                    setViewedRunId(id)
                    setActiveTab('report')
                  }}
                  onDelete={(id) => {
                    setRunHistory((prev) => prev.filter((r) => r.id !== id))
                    if (viewedRunId === id) setViewedRunId(null)
                  }}
                  onCompare={setCompareIds}
                />
              </TabsContent>
            </Tabs>
          )}
        </section>
      </main>
    </div>
  )
}

function ColumnHeading({ step, title }: { step: number; title: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary">
        {step}
      </span>
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
    </div>
  )
}
