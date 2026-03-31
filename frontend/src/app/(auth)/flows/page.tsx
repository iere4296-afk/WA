'use client'

import { useMemo, useState } from 'react'
import { Plus, Search, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonPage } from '@/components/shared/SkeletonPage'
import { FlowBuilder } from '@/components/flows/FlowBuilder'
import { FlowCard } from '@/components/flows/FlowCard'
import { NewFlowDialog } from '@/components/flows/NewFlowDialog'
import { useCreateFlow, useDeleteFlow, useFlow, useFlows } from '@/hooks/useFlows'
import type { Flow } from '@/types'

const DEFAULT_FLOW = {
  name: '',
  description: '',
  triggerType: 'manual' as Flow['trigger_type'],
}

export default function FlowsPage() {
  const [search, setSearch] = useState('')
  const [newFlowOpen, setNewFlowOpen] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [draftFlow, setDraftFlow] = useState(DEFAULT_FLOW)

  const flowsQuery = useFlows({ limit: 100 })
  const flowQuery = useFlow(selectedFlowId || undefined)
  const createFlow = useCreateFlow()
  const deleteFlow = useDeleteFlow()

  const flows = flowsQuery.data?.data || []
  const filteredFlows = useMemo(() => {
    const searchValue = search.trim().toLowerCase()
    return flows.filter((flow) => {
      if (!searchValue) return true
      return flow.name.toLowerCase().includes(searchValue)
        || (flow.description || '').toLowerCase().includes(searchValue)
    })
  }, [flows, search])

  async function handleCreateFlow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const flow = await createFlow.mutateAsync({
        name: draftFlow.name,
        description: draftFlow.description || undefined,
        triggerType: draftFlow.triggerType,
      })
      toast.success('Flow created.')
      setDraftFlow(DEFAULT_FLOW)
      setNewFlowOpen(false)
      setSelectedFlowId(flow.id)
      setBuilderOpen(true)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to create flow.')
    }
  }

  async function handleDeleteFlow() {
    if (!deleteId) return

    try {
      await deleteFlow.mutateAsync(deleteId)
      toast.success('Flow deleted.')
      setDeleteId(null)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to delete flow.')
      throw error
    }
  }

  if (flowsQuery.isLoading && !flowsQuery.data) {
    return <SkeletonPage rows={5} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Flows</h2>
          <p className="text-sm text-slate-500">
            Build automated journeys with message, wait, condition, and action steps.
          </p>
        </div>

        <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setNewFlowOpen(true)}>
          <Plus className="h-4 w-4" />
          New Flow
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-10"
          placeholder="Search flows"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {filteredFlows.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredFlows.map((flow) => (
            <div key={flow.id} className="space-y-2">
              <FlowCard
                flow={flow}
                onClick={(flowId) => {
                  setSelectedFlowId(flowId)
                  setBuilderOpen(true)
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:text-rose-700"
                onClick={() => setDeleteId(flow.id)}
              >
                Delete Flow
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Workflow}
          title="No flows yet"
          description="Create a flow to automate multi-step outreach and follow-up logic."
          action={{ label: 'New Flow', onClick: () => setNewFlowOpen(true) }}
        />
      )}

      <NewFlowDialog open={newFlowOpen} onOpenChange={setNewFlowOpen}>
        <form onSubmit={handleCreateFlow} className="space-y-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Flow name</span>
            <Input
              value={draftFlow.name}
              onChange={(event) => setDraftFlow((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={draftFlow.description}
              onChange={(event) => setDraftFlow((current) => ({ ...current, description: event.target.value }))}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Trigger type</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={draftFlow.triggerType}
              onChange={(event) => setDraftFlow((current) => ({
                ...current,
                triggerType: event.target.value as Flow['trigger_type'],
              }))}
            >
              <option value="manual">Manual</option>
              <option value="campaign_completion">Campaign Completion</option>
              <option value="tag_added">Tag Added</option>
              <option value="api">API</option>
            </select>
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setNewFlowOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" type="submit" disabled={createFlow.isPending}>
              Create Flow
            </Button>
          </div>
        </form>
      </NewFlowDialog>

      <FlowBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        flow={(flowQuery.data as any) || null}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        title="Delete this flow?"
        description="Deleting a flow removes its builder configuration and enrollments."
        destructive
        confirmText={deleteFlow.isPending ? 'Deleting...' : 'Delete Flow'}
        onConfirm={handleDeleteFlow}
      />
    </div>
  )
}
