'use client'

import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  Bot,
  Megaphone,
  MessageSquareText,
  Smartphone,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonPage } from '@/components/shared/SkeletonPage'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useAnalyticsOverview, useAnalyticsVolume, useDeviceAnalytics } from '@/hooks/useAnalytics'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useCampaignsRealtime, useDevicesRealtime } from '@/hooks/useRealtime'
import { formatDate, formatRelativeTime } from '@/lib/utils'

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`
}

export default function DashboardPage() {
  const overviewQuery = useAnalyticsOverview()
  const volumeQuery = useAnalyticsVolume()
  const campaignsQuery = useCampaigns({ limit: 5 })
  const devicePerformanceQuery = useDeviceAnalytics()

  useDevicesRealtime()
  useCampaignsRealtime()

  const overview = overviewQuery.data
  const volumeByDay = volumeQuery.data ?? []
  const recentCampaigns = campaignsQuery.data?.data ?? []
  const topDevices = [...(devicePerformanceQuery.data ?? [])]
    .sort((left, right) => right.health_score - left.health_score)
    .slice(0, 3)

  const totalMessages = overview?.totalMessages ?? overview?.messagesSent ?? 0
  const deliveryRate = totalMessages > 0
    ? Math.round(((overview?.delivered ?? 0) / totalMessages) * 100)
    : 0
  const initialLoading = overviewQuery.isLoading
    && volumeQuery.isLoading
    && campaignsQuery.isLoading
    && devicePerformanceQuery.isLoading

  if (initialLoading) {
    return <SkeletonPage rows={4} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Dashboard</h2>
          <p className="text-sm text-slate-500">
            Real-time delivery, device, and campaign performance for the last 30 days.
          </p>
        </div>

        <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Link href="/campaigns">
            View Campaigns
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          title="Total Messages"
          value={totalMessages.toLocaleString()}
          subtitle={`${overview?.delivered ?? 0} delivered`}
          icon={<MessageSquareText className="h-5 w-5" />}
          loading={overviewQuery.isLoading}
        />
        <StatCard
          title="Delivery Rate"
          value={formatPercent(deliveryRate)}
          subtitle={`${overview?.read ?? 0} read`}
          icon={<Activity className="h-5 w-5" />}
          loading={overviewQuery.isLoading}
        />
        <StatCard
          title="Active Devices"
          value={(overview?.activeDevices ?? overview?.connectedDevices ?? 0).toLocaleString()}
          subtitle="Connected, connecting, or warming"
          icon={<Smartphone className="h-5 w-5" />}
          loading={overviewQuery.isLoading}
        />
        <StatCard
          title="Active Campaigns"
          value={(overview?.activeCampaigns ?? 0).toLocaleString()}
          subtitle="Running, scheduled, or paused"
          icon={<Megaphone className="h-5 w-5" />}
          loading={overviewQuery.isLoading}
        />
        <StatCard
          title="Total Contacts"
          value={(overview?.totalContacts ?? 0).toLocaleString()}
          subtitle={`${overview?.replied ?? 0} contacts replied`}
          icon={<Users className="h-5 w-5" />}
          loading={overviewQuery.isLoading}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Message Volume</CardTitle>
            <CardDescription>Daily sent, delivered, and read activity over the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {volumeQuery.isLoading ? (
              <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
            ) : volumeByDay.length === 0 ? (
              <EmptyState
                icon={MessageSquareText}
                title="No message activity yet"
                description="Message volume will appear here once campaigns or inbox traffic start flowing."
              />
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeByDay}>
                    <defs>
                      <linearGradient id="dashboard-sent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="dashboard-delivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="dashboard-read" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        borderColor: '#e2e8f0',
                        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
                      }}
                    />
                    <Area type="monotone" dataKey="sent" stroke="#16a34a" strokeWidth={2.5} fill="url(#dashboard-sent)" />
                    <Area type="monotone" dataKey="delivered" stroke="#0ea5e9" strokeWidth={2} fill="url(#dashboard-delivered)" />
                    <Area type="monotone" dataKey="read" stroke="#6366f1" strokeWidth={2} fill="url(#dashboard-read)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Device Health Overview</CardTitle>
              <CardDescription>Top 3 devices by current health score.</CardDescription>
            </div>
            <Button asChild variant="ghost">
              <Link href="/devices">Devices</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {devicePerformanceQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              ))
            ) : topDevices.length === 0 ? (
              <EmptyState
                icon={Smartphone}
                title="No active devices yet"
                description="Connect a WhatsApp device to start tracking health and delivery performance."
                action={{ label: 'Go to Devices', onClick: () => window.location.assign('/devices') }}
              />
            ) : (
              topDevices.map((device) => {
                const deviceDeliveryRate = device.sent > 0
                  ? Math.round((device.delivered / device.sent) * 100)
                  : 0

                return (
                  <div key={device.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">{device.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {device.sent.toLocaleString()} messages sent
                        </p>
                      </div>
                      <StatusBadge status={device.status} />
                    </div>

                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-500">
                          <span>Health Score</span>
                          <span>{device.health_score}%</span>
                        </div>
                        <Progress value={device.health_score} className="h-2.5 bg-slate-200" />
                      </div>

                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>Delivery rate</span>
                        <span>{formatPercent(deviceDeliveryRate)}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent Campaigns</CardTitle>
            <CardDescription>The latest five campaigns in your workspace.</CardDescription>
          </div>
          <Button asChild variant="ghost">
            <Link href="/campaigns">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {campaignsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : recentCampaigns.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No campaigns yet"
              description="Create your first campaign to start sending messages from connected devices."
              action={{ label: 'Create Campaign', onClick: () => window.location.assign('/campaigns/new') }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCampaigns.map((campaign) => {
                  const progress = campaign.total_contacts > 0
                    ? Math.round((campaign.sent_count / campaign.total_contacts) * 100)
                    : 0

                  return (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-950">{campaign.name}</p>
                          <p className="text-xs text-slate-500">
                            {campaign.sent_count.toLocaleString()} / {campaign.total_contacts.toLocaleString()} sent
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={campaign.status} />
                      </TableCell>
                      <TableCell className="min-w-44">
                        <div className="space-y-2">
                          <Progress value={progress} className="h-2 bg-slate-200" />
                          <p className="text-xs text-slate-500">{formatPercent(progress)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-600">
                          <p>{formatDate(campaign.created_at)}</p>
                          <p className="text-xs text-slate-500">{formatRelativeTime(campaign.created_at)}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
