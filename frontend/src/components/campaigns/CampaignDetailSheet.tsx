'use client'

import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, Radio, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useCampaign, useCampaignMessages, usePauseCampaign, useResumeCampaign, useStopCampaign } from '@/hooks/useCampaigns'
import { useCampaignRealtime } from '@/hooks/useRealtime'
import { formatDate, truncate } from '@/lib/utils'
import { Campaign } from '@/types'
import { CampaignProgressBar } from './CampaignProgressBar'

interface CampaignDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign?: Campaign | null
}

type CampaignDetail = Campaign & {
  liveStats?: Record<string, number>
}

export function CampaignDetailSheet({ open, onOpenChange, campaign }: CampaignDetailSheetProps) {
  const campaignId = campaign?.id || ''
  const campaignQuery = useCampaign(campaignId)
  const pauseCampaign = usePauseCampaign()
  const resumeCampaign = useResumeCampaign()
  const stopCampaign = useStopCampaign()
  const [messageCursor, setMessageCursor] = useState<string | undefined>(undefined)
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([])
  const [confirmStopOpen, setConfirmStopOpen] = useState(false)

  useCampaignRealtime(campaignId)

  useEffect(() => {
    setMessageCursor(undefined)
    setCursorHistory([])
    setConfirmStopOpen(false)
  }, [campaignId, open])

  const detail = (campaignQuery.data || campaign) as CampaignDetail | null | undefined
  const messagesQuery = useCampaignMessages({
    campaignId,
    cursor: messageCursor,
    limit: 10,
  })
  const messages = messagesQuery.data?.data || []
  const messageMeta = messagesQuery.data?.meta

  const stats = useMemo(() => {
    if (!detail) {
      return { sent: 0, delivered: 0, read: 0, failed: 0, replied: 0 }
    }

    return {
      sent: detail.liveStats?.sent ?? detail.sent_count ?? 0,
      delivered: detail.liveStats?.delivered ?? detail.delivered_count ?? 0,
      read: detail.liveStats?.read ?? detail.read_count ?? 0,
      failed: detail.liveStats?.failed ?? detail.failed_count ?? 0,
      replied: detail.liveStats?.replied ?? detail.replied_count ?? 0,
    }
  }, [detail])

  async function handlePause() {
    if (!campaignId) return

    try {
      await pauseCampaign.mutateAsync(campaignId)
      toast.success('Campaign paused.')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to pause campaign.')
    }
  }

  async function handleResume() {
    if (!campaignId) return

    try {
      await resumeCampaign.mutateAsync(campaignId)
      toast.success('Campaign resumed.')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to resume campaign.')
    }
  }

  async function handleStop() {
    if (!campaignId) return

    try {
      await stopCampaign.mutateAsync(campaignId)
      toast.success('Campaign stopped.')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to stop campaign.')
      throw error
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{detail?.name || 'Campaign detail'}</SheetTitle>
          <SheetDescription>
            Live delivery stats, recent messages, and lifecycle controls for the selected campaign.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {detail ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={detail.status} />
                    <span className="text-sm text-slate-500">Updated {formatDate(detail.updated_at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {detail.description || 'Campaign performance and delivery metrics update live via Supabase Realtime.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {detail.status === 'running' ? (
                    <Button variant="outline" onClick={() => void handlePause()} disabled={pauseCampaign.isPending}>
                      <Pause className="h-4 w-4" />
                      Pause
                    </Button>
                  ) : null}
                  {detail.status === 'paused' ? (
                    <Button variant="outline" onClick={() => void handleResume()} disabled={resumeCampaign.isPending}>
                      <Play className="h-4 w-4" />
                      Resume
                    </Button>
                  ) : null}
                  {['running', 'paused'].includes(detail.status) ? (
                    <Button variant="destructive" onClick={() => setConfirmStopOpen(true)} disabled={stopCampaign.isPending}>
                      <Square className="h-4 w-4" />
                      Stop
                    </Button>
                  ) : null}
                </div>
              </div>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Campaign Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <CampaignProgressBar
                    sent={stats.sent}
                    delivered={stats.delivered}
                    read={stats.read}
                    failed={stats.failed}
                    total={detail.total_contacts}
                  />
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  { label: 'Sent', value: stats.sent },
                  { label: 'Delivered', value: stats.delivered },
                  { label: 'Read', value: stats.read },
                  { label: 'Failed', value: stats.failed },
                  { label: 'Stopped', value: detail.status === 'stopped' ? 1 : 0 },
                ].map((item) => (
                  <Card key={item.label} className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-500">{item.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-semibold text-slate-950">{item.value.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Recent Campaign Messages</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {messages.length === 0 && !messagesQuery.isLoading ? (
                    <EmptyState
                      icon={Radio}
                      title="No messages yet"
                      description="Messages will appear here as soon as the campaign starts sending."
                    />
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <div key={message.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium text-slate-950">
                                {truncate(message.content || 'Media message', 120)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">{formatDate(message.created_at)}</p>
                            </div>
                            <StatusBadge status={message.status} size="sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                      {messagesQuery.isLoading ? 'Loading messages...' : `${messages.length} message${messages.length === 1 ? '' : 's'} on this page`}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={cursorHistory.length === 0}
                        onClick={() => {
                          if (cursorHistory.length === 0) return
                          const previousCursor = cursorHistory[cursorHistory.length - 1]
                          setCursorHistory((current) => current.slice(0, -1))
                          setMessageCursor(previousCursor)
                        }}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!messageMeta?.hasMore || !messageMeta.nextCursor}
                        onClick={() => {
                          if (!messageMeta?.nextCursor) return
                          setCursorHistory((current) => [...current, messageCursor])
                          setMessageCursor(messageMeta.nextCursor || undefined)
                        }}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="py-12 text-center text-sm text-slate-500">
                Select a campaign to inspect its live performance.
              </CardContent>
            </Card>
          )}
        </div>

        <ConfirmDialog
          open={confirmStopOpen}
          onOpenChange={setConfirmStopOpen}
          title="Stop this campaign?"
          description="Stopping will halt any further queued sends for this campaign."
          destructive
          confirmText={stopCampaign.isPending ? 'Stopping...' : 'Stop Campaign'}
          onConfirm={handleStop}
        />
      </SheetContent>
    </Sheet>
  )
}
