'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Filter, Megaphone, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CampaignDetailSheet } from '@/components/campaigns/CampaignDetailSheet'
import { CampaignList } from '@/components/campaigns/CampaignList'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonPage } from '@/components/shared/SkeletonPage'
import {
  useCampaigns,
  useDeleteCampaign,
  useLaunchCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useStopCampaign,
} from '@/hooks/useCampaigns'
import { useCampaignsRealtime } from '@/hooks/useRealtime'
import type { Campaign } from '@/types'

export default function CampaignsPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([])
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingStopId, setPendingStopId] = useState<string | null>(null)

  const campaignsQuery = useCampaigns({
    cursor,
    limit: 15,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })
  const launchCampaign = useLaunchCampaign()
  const pauseCampaign = usePauseCampaign()
  const resumeCampaign = useResumeCampaign()
  const stopCampaign = useStopCampaign()
  const deleteCampaign = useDeleteCampaign()

  useCampaignsRealtime()

  useEffect(() => {
    setCursor(undefined)
    setCursorHistory([])
  }, [statusFilter])

  const campaigns = campaignsQuery.data?.data || []
  const pagination = campaignsQuery.data?.meta
  const filteredCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.name.toLowerCase().includes(search.toLowerCase())),
    [campaigns, search],
  )

  async function handleLaunch(id: string) {
    try {
      await launchCampaign.mutateAsync(id)
      toast.success('Campaign launched successfully.')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to launch campaign.')
    }
  }

  async function handlePause(id: string) {
    try {
      await pauseCampaign.mutateAsync(id)
      toast.success('Campaign paused.')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to pause campaign.')
    }
  }

  async function handleResume(id: string) {
    try {
      await resumeCampaign.mutateAsync(id)
      toast.success('Campaign resumed.')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to resume campaign.')
    }
  }

  async function handleStop() {
    if (!pendingStopId) return

    try {
      await stopCampaign.mutateAsync(pendingStopId)
      toast.success('Campaign stopped.')
      setPendingStopId(null)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to stop campaign.')
      throw error
    }
  }

  async function handleDelete() {
    if (!pendingDeleteId) return

    try {
      await deleteCampaign.mutateAsync(pendingDeleteId)
      toast.success('Campaign deleted.')
      if (selectedCampaign?.id === pendingDeleteId) {
        setSelectedCampaign(null)
      }
      setPendingDeleteId(null)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to delete campaign.')
      throw error
    }
  }

  if (campaignsQuery.isLoading && !campaignsQuery.data) {
    return <SkeletonPage rows={5} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Campaigns</h2>
          <p className="text-sm text-slate-500">
            Launch broadcasts, monitor delivery, and react to live campaign performance from a single queue.
          </p>
        </div>

        <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Link href="/campaigns/new">
            <Plus className="h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="px-3 py-1">
          <Megaphone className="mr-1 h-3.5 w-3.5" />
          {campaigns.length} on this page
        </Badge>
        <Badge variant="secondary" className="px-3 py-1">
          {campaigns.filter((campaign) => campaign.status === 'running').length} running
        </Badge>
        <Badge variant="secondary" className="px-3 py-1">
          {campaigns.filter((campaign) => campaign.status === 'scheduled').length} scheduled
        </Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.5fr]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search campaigns by name"
        />
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            className="h-10 w-full bg-transparent text-sm outline-none"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="stopped">Stopped</option>
          </select>
        </label>
      </div>

      {campaigns.length === 0 && !campaignsQuery.isLoading ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create a campaign to target contact lists, launch now, or schedule a send for later."
          action={{ label: 'New Campaign', onClick: () => router.push('/campaigns/new') }}
        />
      ) : (
        <CampaignList
          campaigns={filteredCampaigns}
          loading={campaignsQuery.isLoading}
          onSelect={setSelectedCampaign}
          onLaunch={(campaignId) => void handleLaunch(campaignId)}
          onPause={(campaignId) => void handlePause(campaignId)}
          onResume={(campaignId) => void handleResume(campaignId)}
          onStop={(campaignId) => setPendingStopId(campaignId)}
          onDelete={(campaignId) => setPendingDeleteId(campaignId)}
          pagination={{
            nextCursor: pagination?.nextCursor,
            previousCursor: cursorHistory.length > 0 ? 'previous' : null,
            hasMore: pagination?.hasMore,
          }}
          onNextPage={() => {
            if (!pagination?.nextCursor) return
            setCursorHistory((current) => [...current, cursor])
            setCursor(pagination.nextCursor || undefined)
          }}
          onPreviousPage={() => {
            if (cursorHistory.length === 0) return
            const previousCursor = cursorHistory[cursorHistory.length - 1]
            setCursorHistory((current) => current.slice(0, -1))
            setCursor(previousCursor)
          }}
        />
      )}

      <CampaignDetailSheet
        open={!!selectedCampaign}
        onOpenChange={(open) => {
          if (!open) setSelectedCampaign(null)
        }}
        campaign={selectedCampaign}
      />

      <ConfirmDialog
        open={!!pendingStopId}
        onOpenChange={(open) => {
          if (!open) setPendingStopId(null)
        }}
        title="Stop this campaign?"
        description="Queued sends will stop and the campaign will move to a stopped state."
        destructive
        confirmText={stopCampaign.isPending ? 'Stopping...' : 'Stop Campaign'}
        onConfirm={handleStop}
      />

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null)
        }}
        title="Delete this campaign?"
        description="This performs the backend delete flow and removes the campaign from the active list."
        destructive
        confirmText={deleteCampaign.isPending ? 'Deleting...' : 'Delete Campaign'}
        onConfirm={handleDelete}
      />
    </div>
  )
}
