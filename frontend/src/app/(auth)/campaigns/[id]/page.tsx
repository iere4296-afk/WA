'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3, Clock3, MessageSquareText } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonPage } from '@/components/shared/SkeletonPage'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { api } from '@/lib/api'
import { formatDate, truncate } from '@/lib/utils'
import { useCampaign } from '@/hooks/useCampaigns'
import { useCampaignRealtime } from '@/hooks/useRealtime'
import type { Message } from '@/types'
import type { CampaignMessagesResponse } from '@/types/api.types'

const PIE_COLORS = ['#22c55e', '#0ea5e9', '#2563eb', '#ef4444']

async function fetchAllCampaignMessages(campaignId: string) {
  const messages: Message[] = []
  let cursor: string | undefined
  let hasMore = true
  let safety = 0

  while (hasMore && safety < 50) {
    safety += 1
    const query = new URLSearchParams()
    query.set('campaignId', campaignId)
    query.set('limit', '200')
    if (cursor) query.set('cursor', cursor)

    const response = await api.get<CampaignMessagesResponse>(`/messages?${query.toString()}`)
    messages.push(...response.data.data)
    cursor = response.data.meta.nextCursor || undefined
    hasMore = Boolean(response.data.meta.hasMore && cursor)
  }

  return messages
}

export default function CampaignDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const campaignId = params?.id || ''
  const campaignQuery = useCampaign(campaignId)
  const campaign = campaignQuery.data
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)

  useCampaignRealtime(campaignId)

  useEffect(() => {
    let active = true

    async function loadMessages() {
      if (!campaignId) return

      setMessagesLoading(true)
      try {
        const result = await fetchAllCampaignMessages(campaignId)
        if (active) setMessages(result)
      } finally {
        if (active) setMessagesLoading(false)
      }
    }

    void loadMessages()

    return () => {
      active = false
    }
  }, [
    campaignId,
    campaign?.updated_at,
    campaign?.sent_count,
    campaign?.delivered_count,
    campaign?.read_count,
    campaign?.failed_count,
  ])

  const stats = useMemo(() => ({
    sent: campaign?.liveStats?.sent ?? campaign?.sent_count ?? 0,
    delivered: campaign?.liveStats?.delivered ?? campaign?.delivered_count ?? 0,
    read: campaign?.liveStats?.read ?? campaign?.read_count ?? 0,
    replied: campaign?.liveStats?.replied ?? campaign?.replied_count ?? 0,
    failed: campaign?.liveStats?.failed ?? campaign?.failed_count ?? 0,
  }), [campaign])

  const volumeData = useMemo(() => {
    const buckets = new Map<string, { date: string; sent: number; delivered: number; read: number; failed: number }>()

    messages.forEach((message) => {
      const sentDate = new Date(message.sent_at || message.created_at).toISOString().slice(0, 10)
      const deliveredDate = new Date(message.delivered_at || message.created_at).toISOString().slice(0, 10)
      const readDate = new Date(message.read_at || message.created_at).toISOString().slice(0, 10)

      if (!buckets.has(sentDate)) {
        buckets.set(sentDate, { date: sentDate, sent: 0, delivered: 0, read: 0, failed: 0 })
      }

      if (message.status !== 'failed') {
        buckets.get(sentDate)!.sent += 1
      } else {
        buckets.get(sentDate)!.failed += 1
      }

      if (message.status === 'delivered' || message.status === 'read') {
        if (!buckets.has(deliveredDate)) {
          buckets.set(deliveredDate, { date: deliveredDate, sent: 0, delivered: 0, read: 0, failed: 0 })
        }
        buckets.get(deliveredDate)!.delivered += 1
      }

      if (message.status === 'read') {
        if (!buckets.has(readDate)) {
          buckets.set(readDate, { date: readDate, sent: 0, delivered: 0, read: 0, failed: 0 })
        }
        buckets.get(readDate)!.read += 1
      }
    })

    return Array.from(buckets.values()).sort((left, right) => left.date.localeCompare(right.date))
  }, [messages])

  const funnelData = useMemo(() => ([
    { name: 'Sent', value: stats.sent },
    { name: 'Delivered', value: stats.delivered },
    { name: 'Read', value: stats.read },
    { name: 'Failed', value: stats.failed },
  ]), [stats.delivered, stats.failed, stats.read, stats.sent])

  const statusDistribution = useMemo(() => ([
    { name: 'Sent', value: stats.sent, color: PIE_COLORS[0] },
    { name: 'Delivered', value: stats.delivered, color: PIE_COLORS[1] },
    { name: 'Read', value: stats.read, color: PIE_COLORS[2] },
    { name: 'Failed', value: stats.failed, color: PIE_COLORS[3] },
  ].filter((entry) => entry.value > 0)), [stats.delivered, stats.failed, stats.read, stats.sent])

  if (campaignQuery.isLoading && !campaign) {
    return <SkeletonPage rows={5} />
  }

  if (!campaign) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Campaign not found"
        description="This campaign may have been deleted or is no longer available for your organization."
        action={{ label: 'Back to Campaigns', onClick: () => router.push('/campaigns') }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Button variant="outline" asChild className="mb-3">
            <Link href="/campaigns">
              <ArrowLeft className="h-4 w-4" />
              Back to Campaigns
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-slate-950">{campaign.name}</h2>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {campaign.description || 'Real-time campaign detail, charting, and delivery insights.'}
          </p>
        </div>

        <div className="grid gap-2 text-sm text-slate-500">
          <span>Created {formatDate(campaign.created_at)}</span>
          <span>{campaign.scheduled_at ? `Scheduled ${formatDate(campaign.scheduled_at)}` : 'Immediate send'}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {Object.entries(stats).map(([label, value]) => (
          <Card key={label} className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="capitalize text-sm font-medium text-slate-500">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-slate-950">{(value as number).toLocaleString()}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Daily Message Activity</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {volumeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="sent" stackId="1" stroke="#22c55e" fill="#bbf7d0" />
                  <Area type="monotone" dataKey="delivered" stackId="1" stroke="#0ea5e9" fill="#bae6fd" />
                  <Area type="monotone" dataKey="read" stackId="1" stroke="#2563eb" fill="#bfdbfe" />
                  <Area type="monotone" dataKey="failed" stackId="1" stroke="#ef4444" fill="#fecaca" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={Clock3}
                title="No delivery history yet"
                description="Once messages start sending, the daily activity chart will populate from real message events."
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Delivery Funnel</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                  >
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={MessageSquareText}
                title="No status data yet"
                description="This chart will render once the campaign produces tracked message events."
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Campaign Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Total contacts</span>
              <span className="font-medium text-slate-950">{campaign.total_contacts.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Min delay</span>
              <span className="font-medium text-slate-950">{campaign.min_delay_seconds}s</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Max delay</span>
              <span className="font-medium text-slate-950">{campaign.max_delay_seconds}s</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Send window</span>
              <span className="font-medium text-slate-950">{campaign.send_window_start} - {campaign.send_window_end}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Messages loaded</span>
              <span className="font-medium text-slate-950">
                {messagesLoading ? 'Loading...' : messages.length.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Recent Campaign Messages</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length > 0 ? (
            <div className="space-y-3">
              {messages.slice(0, 12).map((message) => (
                <div key={message.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-950">{truncate(message.content || 'Media message', 160)}</p>
                      <p className="text-sm text-slate-500">{formatDate(message.created_at)}</p>
                    </div>
                    <StatusBadge status={message.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MessageSquareText}
              title="No campaign messages yet"
              description="Messages sent by this campaign will appear here with their live delivery status."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
