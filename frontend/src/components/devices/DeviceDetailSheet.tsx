'use client'

import { Activity, MessageSquare, ShieldCheck, TimerReset, Wifi } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RuleCheckList } from '@/components/anti-ban/RuleCheckList'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useDevice } from '@/hooks/useDevices'
import { useDeviceAnalytics } from '@/hooks/useAnalytics'
import { formatDate, formatPhone, formatRelativeTime } from '@/lib/utils'
import { Device } from '@/types'
import { QRCodePanel } from './QRCodePanel'

interface DeviceDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceId?: string | null
}

const WARMUP_CURVE = [5, 8, 12, 16, 20, 25, 32, 40, 50, 62, 75, 90, 110, 130, 150, 170, 190, 210, 230, 250]

function getWarmupTarget(day: number, dailyLimit: number) {
  const curveValue = WARMUP_CURVE[Math.max(0, Math.min(day - 1, WARMUP_CURVE.length - 1))] ?? 25
  return Math.min(curveValue, dailyLimit)
}

function buildWarmupSchedule(device: Device | undefined) {
  if (!device) return []

  const targetDay = Math.max(device.warmup_target_day || 30, 1)
  const startDay = Math.max(1, (device.warmup_day || 1) - 2)
  const endDay = Math.min(targetDay, startDay + 9)

  return Array.from({ length: endDay - startDay + 1 }, (_, index) => {
    const day = startDay + index

    return {
      day,
      target: getWarmupTarget(day, device.daily_limit),
      current: day === Math.max(device.warmup_day || 1, 1),
      completed: day < Math.max(device.warmup_day || 1, 1),
    }
  })
}

function calculateUptime(device: Device | undefined) {
  if (!device) return 0

  let baseScore = 0

  if (device.status === 'connected') baseScore = 98
  else if (device.status === 'warming') baseScore = 94
  else if (device.status === 'connecting') baseScore = 74
  else if (device.status === 'disconnected') baseScore = 42
  else if (device.status === 'paused') baseScore = 24
  else return 0

  if (!device.last_active) return baseScore

  const minutesSinceActive = Math.max(0, Math.round((Date.now() - new Date(device.last_active).getTime()) / 60_000))

  if (minutesSinceActive <= 15) return baseScore
  if (minutesSinceActive <= 60) return Math.max(0, baseScore - 4)
  if (minutesSinceActive <= 24 * 60) return Math.max(0, baseScore - 12)
  if (minutesSinceActive <= 7 * 24 * 60) return Math.max(0, baseScore - 24)
  return Math.max(0, baseScore - 40)
}

function HealthGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const tone = clamped >= 80 ? '#16a34a' : clamped >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative mx-auto h-36 w-36">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-semibold text-slate-950">{clamped}</span>
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Health Score</span>
      </div>
    </div>
  )
}

export function DeviceDetailSheet({ open, onOpenChange, deviceId }: DeviceDetailSheetProps) {
  const deviceQuery = useDevice(deviceId)
  const deviceAnalyticsQuery = useDeviceAnalytics()

  const device = deviceQuery.data
  const deviceStats = deviceAnalyticsQuery.data?.find((entry) => entry.id === deviceId)
  const messagesSent = deviceStats?.sent ?? 0
  const deliveredCount = deviceStats?.delivered ?? 0
  const deliveryRate = messagesSent > 0 ? Math.round((deliveredCount / messagesSent) * 100) : 0
  const uptime = calculateUptime(device)
  const warmupSchedule = buildWarmupSchedule(device)
  const currentWarmupLimit = device ? getWarmupTarget(Math.max(device.warmup_day || 1, 1), device.daily_limit) : 0
  const rules = (device?.healthBreakdown?.breakdown ?? []).map((rule) => ({
    name: rule.rule,
    passed: rule.passed,
    detail: rule.detail,
  }))
  const passingRules = rules.filter((rule) => rule.passed).length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-l border-slate-200 bg-white sm:max-w-4xl">
        <SheetHeader className="pr-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <SheetTitle>{device?.name || 'Device detail'}</SheetTitle>
              <SheetDescription>
                {device ? `${formatPhone(device.phone_number)} - Last update ${formatRelativeTime(device.updated_at)}` : 'Loading device data...'}
              </SheetDescription>
            </div>
            {device ? <StatusBadge status={device.status} /> : null}
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 md:grid-cols-4">
            <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
            <TabsTrigger value="qr" className="rounded-xl">QR Code</TabsTrigger>
            <TabsTrigger value="warmup" className="rounded-xl">Warmup</TabsTrigger>
            <TabsTrigger value="health" className="rounded-xl">Health</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 pt-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-500">Messages Sent</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-emerald-500/10 p-3">
                      <MessageSquare className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-3xl font-semibold text-slate-950">{messagesSent.toLocaleString()}</p>
                      <p className="text-sm text-slate-500">Outbound messages tracked</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-500">Delivery Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-sky-500/10 p-3">
                      <Activity className="h-5 w-5 text-sky-600" />
                    </div>
                    <div>
                      <p className="text-3xl font-semibold text-slate-950">{deliveryRate}%</p>
                      <p className="text-sm text-slate-500">{deliveredCount.toLocaleString()} delivered or read</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-500">Uptime</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-violet-500/10 p-3">
                      <Wifi className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-3xl font-semibold text-slate-950">{uptime}%</p>
                      <p className="text-sm text-slate-500">
                        {device?.last_active ? `Last active ${formatRelativeTime(device.last_active)}` : 'No recent heartbeat'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Device Info</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Phone</p>
                  <p className="mt-2 font-medium text-slate-950">{formatPhone(device?.phone_number)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Daily Limit</p>
                  <p className="mt-2 font-medium text-slate-950">{device?.daily_limit?.toLocaleString() ?? 0} messages</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Warmup</p>
                  <p className="mt-2 font-medium text-slate-950">
                    Day {device?.warmup_day ?? 0} of {device?.warmup_target_day ?? 30}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Last Reset</p>
                  <p className="mt-2 font-medium text-slate-950">{formatDate(device?.last_reset_at)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Created</p>
                  <p className="mt-2 font-medium text-slate-950">{formatDate(device?.created_at)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Session Key Version</p>
                  <p className="mt-2 font-medium text-slate-950">{device?.session_key_version || 'v1'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Notes</p>
                  <p className="mt-2 font-medium text-slate-950">{device?.notes || 'No notes saved for this device.'}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="qr" className="space-y-4 pt-4">
            {deviceId ? (
              <QRCodePanel
                deviceId={deviceId}
                initialQrCode={device?.qr_code}
                initialStatus={device?.status}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="warmup" className="space-y-6 pt-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Warmup Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current Day</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{device?.warmup_day ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current Day Limit</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{currentWarmupLimit.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Target Completion</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{device?.warmup_target_day ?? 30} days</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Warmup completion</span>
                    <span>{Math.round(((device?.warmup_day ?? 0) / Math.max(device?.warmup_target_day ?? 30, 1)) * 100)}%</span>
                  </div>
                  <Progress
                    value={((device?.warmup_day ?? 0) / Math.max(device?.warmup_target_day ?? 30, 1)) * 100}
                    className="h-3 bg-slate-200"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Warmup Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {warmupSchedule.map((entry) => (
                  <div
                    key={entry.day}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                      entry.current
                        ? 'border-emerald-200 bg-emerald-50'
                        : entry.completed
                          ? 'border-slate-200 bg-slate-50'
                          : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-slate-950">Day {entry.day}</p>
                      <p className="text-sm text-slate-500">
                        {entry.current ? 'Current warmup target' : entry.completed ? 'Completed day' : 'Upcoming target'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-950">{entry.target.toLocaleString()}</p>
                      <p className="text-sm text-slate-500">messages</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health" className="space-y-6 pt-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Health Score</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <HealthGauge score={device?.health_score ?? 0} />

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Rules Passed</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{passingRules}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Rules Failed</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{Math.max(rules.length - passingRules, 0)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Recent Activity</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{formatRelativeTime(device?.updated_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Rule Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                {rules.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    Health rules are still loading for this device.
                  </div>
                ) : (
                  <RuleCheckList rules={rules} />
                )}
              </CardContent>
            </Card>

            {device?.recentHealthEvents?.length ? (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Recent Health Events</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {device.recentHealthEvents.slice(0, 8).map((event) => (
                    <div key={event.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                      <div className="rounded-2xl bg-slate-100 p-2">
                        {event.severity === 'critical' ? <ShieldCheck className="h-4 w-4 text-red-600" /> : <TimerReset className="h-4 w-4 text-slate-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-950">{event.event_type.replace(/_/g, ' ')}</p>
                        <p className="text-sm text-slate-500">{formatDate(event.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
