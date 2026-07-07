import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  ClipboardPaste,
  GripVertical,
  ImagePlus,
  LayoutTemplate,
  ListOrdered,
  Plus,
  Target,
  Trash2,
  X,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { FLOW_TEMPLATES } from '@/lib/templates'
import type { FlowStep, SavedFlow, StepImage } from '@/types'

interface DesignCanvasProps {
  flowName: string
  onFlowNameChange: (name: string) => void
  taskGoal: string
  onTaskGoalChange: (goal: string) => void
  steps: FlowStep[]
  onStepsChange: (steps: FlowStep[]) => void
  savedFlows: SavedFlow[]
  /** persists the current canvas; 'name-collision' means an overwrite needs confirming */
  onSaveFlow: (overwrite?: boolean) => { id: string } | 'name-collision' | null
  onDeleteFlow: (id: string) => void
  disabled?: boolean
}

let stepCounter = 0
function newStepId() {
  stepCounter += 1
  return `step-${Date.now()}-${stepCounter}`
}

export function DesignCanvas({
  flowName,
  onFlowNameChange,
  taskGoal,
  onTaskGoalChange,
  steps,
  onStepsChange,
  savedFlows,
  onSaveFlow,
  onDeleteFlow,
  disabled,
}: DesignCanvasProps) {
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const [libraryId, setLibraryId] = useState<string>('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [flashStepId, setFlashStepId] = useState<string | null>(null)

  // Refs so the window-level paste listener always sees current state.
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  const focusedStepRef = useRef<string | null>(null)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  const loadFromLibrary = (id: string) => {
    const tpl = FLOW_TEMPLATES.find((t) => t.id === id)
    if (tpl) {
      onFlowNameChange(tpl.name)
      onTaskGoalChange(tpl.taskGoal)
      onStepsChange(tpl.steps.map((s) => ({ ...s, id: newStepId() })))
      setLibraryId(id)
      return
    }
    const saved = savedFlows.find((f) => f.id === id)
    if (saved) {
      onFlowNameChange(saved.name)
      onTaskGoalChange(saved.taskGoal)
      onStepsChange(saved.steps.map((s) => ({ ...s, id: newStepId() })))
      setLibraryId(id)
    }
  }

  const [overwriteOpen, setOverwriteOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleSave = (overwrite = false) => {
    const result = onSaveFlow(overwrite)
    if (result === 'name-collision') {
      setOverwriteOpen(true)
    } else if (result && typeof result === 'object') {
      setLibraryId(result.id)
    }
  }

  const selectedSavedFlow = savedFlows.find((f) => f.id === libraryId)

  const updateStep = (id: string, patch: Partial<FlowStep>) => {
    onStepsChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const removeStep = (id: string) => {
    onStepsChange(steps.filter((s) => s.id !== id))
  }

  const addStep = () => {
    onStepsChange([...steps, { id: newStepId(), text: '' }])
  }

  const handleImageFile = (stepId: string, file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const image: StepImage = { data: dataUrl, mimeType: file.type, name: file.name }
      updateStep(stepId, { image })
      setFlashStepId(stepId)
      setTimeout(() => setFlashStepId((cur) => (cur === stepId ? null : cur)), 1200)
    }
    reader.readAsDataURL(file)
  }

  /**
   * Bulk drop: assign image files (sorted by name) to image-less steps in
   * order; any extras append new empty-text steps carrying the image.
   */
  const handleBulkImageFiles = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/')).sort((a, b) => a.name.localeCompare(b.name))
    if (images.length === 0) return

    let working = [...stepsRef.current]
    const assignments: { stepId: string; file: File }[] = []
    for (const file of images) {
      const slot = working.find((s) => !s.image && !assignments.some((a) => a.stepId === s.id))
      if (slot) {
        assignments.push({ stepId: slot.id, file })
      } else {
        const fresh: FlowStep = { id: newStepId(), text: '' }
        working = [...working, fresh]
        assignments.push({ stepId: fresh.id, file })
      }
    }
    if (working.length !== stepsRef.current.length) onStepsChange(working)
    assignments.forEach(({ stepId, file }) => handleImageFile(stepId, file))
  }

  /** Window-level paste: route a clipboard image to the focused step, else the first image-less one. */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (disabledRef.current) return
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (!file) return
      const current = stepsRef.current
      const target =
        current.find((s) => s.id === focusedStepRef.current) ??
        current.find((s) => !s.image) ??
        current[current.length - 1]
      if (!target) return
      e.preventDefault()
      handleImageFile(target.id, file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reorderStep = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= steps.length || to >= steps.length) return
    const next = [...steps]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onStepsChange(next)
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListOrdered className="h-4 w-4 text-primary" />
          Design Canvas & User Flow
        </CardTitle>
        <CardDescription>
          Define the intended task sequence, then drop the matching screenshot or wireframe into each
          step's visual slot.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Flow Library
          </Label>
          <div className="flex gap-2">
            <Select value={libraryId} onValueChange={loadFromLibrary} disabled={disabled}>
              <SelectTrigger className="min-w-0 flex-1">
                <SelectValue placeholder="Load a template or saved flow…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Casting Networks Templates</SelectLabel>
                  {FLOW_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {savedFlows.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>My Saved Flows</SelectLabel>
                    {savedFlows.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          · {f.steps.length} steps
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              title={
                !flowName.trim()
                  ? 'Name the flow below before saving it to the library'
                  : 'Save current flow to library'
              }
              aria-label="Save current flow to library"
              disabled={disabled || !flowName.trim() || steps.every((s) => !s.text.trim())}
              onClick={() => handleSave(false)}
            >
              <BookmarkPlus className="h-4 w-4" />
            </Button>
            {selectedSavedFlow && (
              <Button
                variant="outline"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                title="Delete this saved flow from the library"
                aria-label="Delete this saved flow from the library"
                disabled={disabled}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Name the flow below, then hit the bookmark to keep it (steps and screenshots included).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="flow-name">Flow Name</Label>
          <Input
            id="flow-name"
            value={flowName}
            placeholder="e.g. Self-tape submission v3 redesign"
            onChange={(e) => onFlowNameChange(e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-goal" className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            What is the user trying to accomplish?
          </Label>
          <Textarea
            id="task-goal"
            value={taskGoal}
            placeholder="The high-stakes outcome the persona cares about, in their words…"
            onChange={(e) => onTaskGoalChange(e.target.value)}
            disabled={disabled}
            rows={2}
          />
        </div>

        <div
          className="space-y-3"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) e.preventDefault()
          }}
          onDrop={(e) => {
            if (e.dataTransfer.files.length > 0) {
              e.preventDefault()
              if (!disabled) handleBulkImageFiles([...e.dataTransfer.files])
            }
            setDragIndex(null)
            setDropIndex(null)
          }}
        >
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5">
              User Flow Steps ({steps.length})
              <span className="flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
                <ClipboardPaste className="h-3 w-3" />
                paste or drop screenshots anywhere below
              </span>
            </Label>
            <Button variant="outline" size="sm" onClick={addStep} disabled={disabled}>
              <Plus className="h-3.5 w-3.5" />
              Add Step
            </Button>
          </div>

          {steps.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No steps yet — add one manually, quick-load a template above, or drop a batch of
              screenshots here to scaffold steps from them.
            </div>
          )}

          {steps.map((step, i) => (
            <div
              key={step.id}
              onDragOver={(e) => {
                if (dragIndex !== null) {
                  e.preventDefault()
                  e.stopPropagation()
                  setDropIndex(i)
                }
              }}
              onDrop={(e) => {
                if (dragIndex !== null) {
                  e.preventDefault()
                  e.stopPropagation()
                  reorderStep(dragIndex, i)
                  setDragIndex(null)
                  setDropIndex(null)
                }
              }}
              className={cn(
                'rounded-lg border bg-muted/20 p-3 transition-shadow',
                dragIndex !== null && dropIndex === i && dragIndex !== i && 'ring-2 ring-primary',
                dragIndex === i && 'opacity-50',
                flashStepId === step.id && 'ring-2 ring-emerald-400'
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <button
                    type="button"
                    draggable={!disabled}
                    onDragStart={(e) => {
                      setDragIndex(i)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', String(i))
                    }}
                    onDragEnd={() => {
                      setDragIndex(null)
                      setDropIndex(null)
                    }}
                    aria-label={`Drag to reorder step ${i + 1}`}
                    title="Drag to reorder"
                    className="mt-1 cursor-grab text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Textarea
                    value={step.text}
                    placeholder={`Step ${i + 1}: what the user is expected to do on this screen…`}
                    onChange={(e) => updateStep(step.id, { text: e.target.value })}
                    onFocus={() => {
                      focusedStepRef.current = step.id
                    }}
                    disabled={disabled}
                    rows={2}
                    className="min-h-[56px] resize-none text-sm"
                  />

                  <Input
                    value={step.expectedOutcome ?? ''}
                    placeholder="Expected outcome (optional): what 'done' looks like — used to judge success"
                    onChange={(e) => updateStep(step.id, { expectedOutcome: e.target.value })}
                    onFocus={() => {
                      focusedStepRef.current = step.id
                    }}
                    disabled={disabled}
                    className="h-8 text-xs"
                  />

                  {/* Visual Context Asset Slot */}
                  <input
                    ref={(node) => {
                      fileInputs.current[step.id] = node
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleImageFile(step.id, file)
                      e.target.value = ''
                    }}
                  />
                  {step.image ? (
                    <div className="group relative inline-block">
                      <img
                        src={step.image.data}
                        alt={`Step ${i + 1} mockup: ${step.image.name}`}
                        className="max-h-36 rounded-md border object-contain"
                      />
                      <button
                        type="button"
                        aria-label="Remove screenshot"
                        onClick={() => updateStep(step.id, { image: undefined })}
                        disabled={disabled}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <p className="mt-1 max-w-[280px] truncate text-[10px] text-muted-foreground">
                        {step.image.name}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => fileInputs.current[step.id]?.click()}
                      onFocus={() => {
                        focusedStepRef.current = step.id
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const files = [...(e.dataTransfer.files ?? [])]
                        if (files.length > 1) handleBulkImageFiles(files)
                        else if (files[0]) handleImageFile(step.id, files[0])
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed py-3 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      <ImagePlus className="h-4 w-4" />
                      Drop or paste screenshot / wireframe here, or click to browse
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={disabled || i === 0}
                    onClick={() => reorderStep(i, i - 1)}
                    aria-label="Move step up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={disabled || i === steps.length - 1}
                    onClick={() => reorderStep(i, i + 1)}
                    aria-label="Move step down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={disabled}
                    onClick={() => removeStep(step.id)}
                    aria-label="Delete step"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <AlertDialog open={overwriteOpen} onOpenChange={setOverwriteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Overwrite “{flowName.trim()}”?</AlertDialogTitle>
              <AlertDialogDescription>
                A flow with this name already exists in the library. Saving will replace its steps and
                screenshots with the current canvas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setOverwriteOpen(false)
                  handleSave(true)
                }}
              >
                Overwrite flow
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{selectedSavedFlow?.name}” from the library?</AlertDialogTitle>
              <AlertDialogDescription>
                The canvas keeps its current content — only the saved library copy is removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (selectedSavedFlow) {
                    onDeleteFlow(selectedSavedFlow.id)
                    setLibraryId('')
                  }
                  setDeleteOpen(false)
                }}
              >
                Delete flow
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
