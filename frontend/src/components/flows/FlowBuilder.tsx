'use client'

import { useEffect, useMemo, useState } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { GripVertical, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { useSaveFlowSteps } from '@/hooks/useFlows'
import { useTemplates } from '@/hooks/useTemplates'
import type { Flow, FlowStep, MessageTemplate } from '@/types'

type FlowWithSteps = Flow & {
  flow_steps?: FlowStep[]
}

type BuilderStep = {
  id: string
  name: string
  type: FlowStep['type']
  delayHours: number
  templateId?: string
  aiPrompt?: string
  conditionRules: Record<string, unknown>
}

interface FlowBuilderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  flow: FlowWithSteps | null
}

function toBuilderStep(step: FlowStep, index: number): BuilderStep {
  return {
    id: step.id || `step-${index + 1}`,
    name: step.name,
    type: step.type,
    delayHours: step.delay_hours,
    templateId: step.template_id,
    aiPrompt: step.ai_prompt,
    conditionRules: step.condition_rules || {},
  }
}

export function FlowBuilder({ open, onOpenChange, flow }: FlowBuilderProps) {
  const templatesQuery = useTemplates({ limit: 100 })
  const saveFlowSteps = useSaveFlowSteps()
  const [steps, setSteps] = useState<BuilderStep[]>([])

  const templates = templatesQuery.data?.data || []

  useEffect(() => {
    if (!flow) {
      setSteps([])
      return
    }

    const sortedSteps = [...(flow.flow_steps || [])].sort((left, right) => left.step_order - right.step_order)
    setSteps(sortedSteps.map(toBuilderStep))
  }, [flow])

  const stepCountLabel = useMemo(
    () => `${steps.length} step${steps.length === 1 ? '' : 's'}`,
    [steps.length],
  )

  function handleAddStep() {
    setSteps((current) => [
      ...current,
      {
        id: `step-${Date.now()}`,
        name: `Step ${current.length + 1}`,
        type: 'message',
        delayHours: 24,
        conditionRules: {},
      },
    ])
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return

    setSteps((current) => {
      const reordered = [...current]
      const [moved] = reordered.splice(result.source.index, 1)
      reordered.splice(result.destination!.index, 0, moved)
      return reordered
    })
  }

  async function handleSave() {
    if (!flow) return

    try {
      await saveFlowSteps.mutateAsync({
        flowId: flow.id,
        steps: steps.map((step) => ({
          id: step.id.startsWith('step-') ? undefined : step.id,
          name: step.name,
          delayHours: step.delayHours,
          type: step.type,
          templateId: step.templateId || undefined,
          aiPrompt: step.aiPrompt || undefined,
          conditionRules: step.conditionRules,
        })),
      })
      toast.success('Flow steps saved.')
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to save flow steps.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{flow?.name || 'Flow Builder'}</SheetTitle>
          <SheetDescription>
            Arrange message, wait, condition, and action steps for this automation flow.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-medium text-slate-950">{stepCountLabel}</p>
            <Button variant="outline" onClick={handleAddStep}>
              <Plus className="h-4 w-4" />
              Add Step
            </Button>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="flow-steps">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-4"
                >
                  {steps.map((step, index) => (
                    <Draggable key={step.id} draggableId={step.id} index={index}>
                      {(draggableProvided) => (
                        <div
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <button
                              className="mt-2 rounded-lg border border-slate-200 p-2 text-slate-400"
                              {...draggableProvided.dragHandleProps}
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>

                            <div className="flex-1 space-y-4">
                              <div className="grid gap-4 md:grid-cols-[1fr_180px_140px]">
                                <label className="space-y-2">
                                  <span className="text-sm font-medium text-slate-700">Step name</span>
                                  <Input
                                    value={step.name}
                                    onChange={(event) => setSteps((current) => current.map((entry) => (
                                      entry.id === step.id ? { ...entry, name: event.target.value } : entry
                                    )))}
                                  />
                                </label>

                                <label className="space-y-2">
                                  <span className="text-sm font-medium text-slate-700">Step type</span>
                                  <select
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                    value={step.type}
                                    onChange={(event) => setSteps((current) => current.map((entry) => (
                                      entry.id === step.id ? { ...entry, type: event.target.value as FlowStep['type'] } : entry
                                    )))}
                                  >
                                    <option value="message">Message</option>
                                    <option value="wait">Wait</option>
                                    <option value="condition">Condition</option>
                                    <option value="action">Action</option>
                                  </select>
                                </label>

                                <label className="space-y-2">
                                  <span className="text-sm font-medium text-slate-700">Delay (hours)</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={step.delayHours}
                                    onChange={(event) => setSteps((current) => current.map((entry) => (
                                      entry.id === step.id ? { ...entry, delayHours: Number(event.target.value) } : entry
                                    )))}
                                  />
                                </label>
                              </div>

                              {step.type === 'message' ? (
                                <label className="space-y-2">
                                  <span className="text-sm font-medium text-slate-700">Template</span>
                                  <select
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                    value={step.templateId || ''}
                                    onChange={(event) => setSteps((current) => current.map((entry) => (
                                      entry.id === step.id ? { ...entry, templateId: event.target.value } : entry
                                    )))}
                                  >
                                    <option value="">Select a template</option>
                                    {templates.map((template: MessageTemplate) => (
                                      <option key={template.id} value={template.id}>
                                        {template.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}

                              {step.type === 'condition' ? (
                                <label className="space-y-2">
                                  <span className="text-sm font-medium text-slate-700">Condition rule</span>
                                  <textarea
                                    className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    value={String(step.conditionRules.expression || '')}
                                    onChange={(event) => setSteps((current) => current.map((entry) => (
                                      entry.id === step.id
                                        ? { ...entry, conditionRules: { ...entry.conditionRules, expression: event.target.value } }
                                        : entry
                                    )))}
                                    placeholder="Example: contact has tag vip"
                                  />
                                </label>
                              ) : null}

                              {step.type === 'action' ? (
                                <label className="space-y-2">
                                  <span className="text-sm font-medium text-slate-700">Action details</span>
                                  <textarea
                                    className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    value={step.aiPrompt || ''}
                                    onChange={(event) => setSteps((current) => current.map((entry) => (
                                      entry.id === step.id ? { ...entry, aiPrompt: event.target.value } : entry
                                    )))}
                                    placeholder="Describe the action to take at this step"
                                  />
                                </label>
                              ) : null}

                              <div className="flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-600 hover:text-rose-700"
                                  onClick={() => setSteps((current) => current.filter((entry) => entry.id !== step.id))}
                                >
                                  Remove Step
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => void handleSave()}
              disabled={!flow || saveFlowSteps.isPending}
            >
              Save Flow
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
