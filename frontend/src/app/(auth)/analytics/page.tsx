'use client'

import { useMemo, useState } from 'react'
import { subDays } from 'date-fns'
import { Activity, BarChart3, Download, Gauge, MessageCircleMore } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonPage } from '@/components/shared/SkeletonPage'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  useAnalyticsCampaignComparison,
  useAnalyticsFunnel,
  useAnalyticsHealthHistory,
  useAnalyticsOverview,
  useAnalyticsVolume,
} from '@/hooks/useAnalytics'

const RANGE_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
]

const DEVICE_LINE_COLORS = ['#22c55e', '#0ea5e9', '#2563eb', '#f97316', '#a855f7', '#ef4444']

export default function AnalyticsPage() {
  const [range, setRange] = useState('30')

  const start = useMemo(
    () => subDays(new Date(), Math.max(Number(range) - 1, 0)).toISOString(),
    [range],
  )

  const overviewQuery = useAnalyticsOverview({ start })
  const volumeQuery = useAnalyticsVolume({ start })
  const funnelQuery = useAnalyticsFunnel({ start })
  const healthHistoryQuery = useAnalyticsHealthHistory({ start })
  const campaignComparisonQuery = useAnalyticsCampaignComparison({ start })

  const overview = overviewQuery.data
  const volumeData = volumeQuery.data || []
  const funnel = funnelQuery.data
  const healthHistory = healthHistoryQuery.data
  const campaignComparison = campaignComparisonQuery.data || []

  const loading = [
    overviewQuery.isLoading,
    volumeQuery.isLoading,
    funnelQuery.isLoading,
    healthHistoryQuery.isLoading,
    campaignComparisonQuery.isLoading,
  ].some(Boolean)

  const deliveryRate = overview?.messagesSent
    ? Math.round((overview.delivered / overview.messagesSent) * 100)
    : 0
  const readRate = overview?.delivered
    ? Math.round((overview.read / overview.delivered) * 100)
    : 0

  function handleExport() {
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '')
    window.open(`${baseUrl}/analytics/export?start=${encodeURIComponent(start)}`, '_blank', 'noopener,noreferrer')
  }

  if (loading && !overview && volumeData.length === 0 && campaignComparison.length === 0) {
    return <SkeletonPage rows={4} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Analytics</h2>
          <p className="mt-1 text-sm text-slate-500">
            Real delivery, read, campaign, and device health trends pulled from the live API.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Messages"
          value={overview?.totalMessages?.toLocaleString() || '0'}
          subtitle={`${range}-day outbound and inbound volume`}
          icon={<MessageCircleMore className="h-5 w-5" />}
          loading={overviewQuery.isLoading && !overview}
        />
        <StatCard
          title="Delivery Rate"
          value={`${deliveryRate}%`}
          subtitle={`${overview?.delivered?.toLocaleString() || '0'} delivered`}
          icon={<BarChart3 className="h-5 w-5" />}
          loading={overviewQuery.isLoading && !overview}
        />
        <StatCard
          title="Read Rate"
          value={`${readRate}%`}
          subtitle={`${overview?.read?.toLocaleString() || '0'} reads`}
          icon={<Activity className="h-5 w-5" />}
          loading={overviewQuery.isLoading && !overview}
        />
        <StatCard
          title="Active Devices"
          value={overview?.activeDevices || 0}
          subtitle={`${overview?.activeCampaigns || 0} active campaigns`}
          icon={<Gauge className="h-5 w-5" />}
          loading={overviewQuery.isLoading && !overview}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>MessageVolumeChart</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {volumeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeData}>
                  <defs>
                    <linearGradient id="analytics-sent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="analytics-delivered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="analytics-read" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="sent" stroke="#22c55e" fill="url(#analytics-sent)" strokeWidth={2} />
                  <Area type="monotone" dataKey="delivered" stroke="#0ea5e9" fill="url(#analytics-delivered)" strokeWidth={2} />
                  <Area type="monotone" dataKey="read" stroke="#2563eb" fill="url(#analytics-read)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No message activity yet"
                description="Once your org starts sending or receiving messages, the daily status breakdown will appear here."
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>DeliveryFunnelChart</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {funnel ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { stage: 'Sent', value: funnel.sent },
                    { stage: 'Delivered', value: funnel.delivered },
                    { stage: 'Read', value: funnel.read },
                    { stage: 'Replied', value: funnel.replied },
                  ]}
                >
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="stage" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#22c55e" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={Activity}
                title="No funnel data yet"
                description="The sent-to-read funnel will show up once message records exist in this date range."
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm xl:col-span-2">
          <CardHeader>
            <CardTitle>DeviceHealthChart</CardTitle>
          </CardHeader>
          <CardContent className="h-96">
            {healthHistory?.devices?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={healthHistory.points}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  {healthHistory.devices.map((device, index) => (
                    <Line
                      key={device.id}
                      type="monotone"
                      dataKey={device.name}
                      stroke={DEVICE_LINE_COLORS[index % DEVICE_LINE_COLORS.length]}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={Gauge}
                title="No device health history yet"
                description="Connected devices and logged health events are required before per-device health trends can be charted."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Campaign comparison table</CardTitle>
        </CardHeader>
        <CardContent>
          {campaignComparison.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-3 py-3 font-medium">Campaign</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 text-right font-medium">Sent</th>
                    <th className="px-3 py-3 text-right font-medium">Delivered</th>
                    <th className="px-3 py-3 text-right font-medium">Read</th>
                    <th className="px-3 py-3 text-right font-medium">Failed</th>
                    <th className="px-3 py-3 text-right font-medium">Read Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignComparison.map((campaign) => {
                    const campaignReadRate = campaign.delivered_count
                      ? Math.round((campaign.read_count / campaign.delivered_count) * 100)
                      : 0

                    return (
                      <tr key={campaign.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-950">{campaign.name}</div>
                          <div className="text-xs text-slate-500">{campaign.total_contacts.toLocaleString()} contacts</div>
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={campaign.status} size="sm" />
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700">{campaign.sent_count.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{campaign.delivered_count.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{campaign.read_count.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{campaign.failed_count.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-medium text-slate-950">{campaignReadRate}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={MessageCircleMore}
              title="No campaigns in range"
              description="Campaign comparison will populate once this organization has real campaign data in the selected window."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
