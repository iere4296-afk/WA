'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import { RuleCheckList } from '@/components/anti-ban/RuleCheckList'

export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>()
  const deviceId = params?.id
  const { data } = useQuery({
    queryKey: ['devices', deviceId],
    enabled: !!deviceId,
    queryFn: async () => (await api.get(`/devices/${deviceId}`)).data.data,
  })

  if (!data) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Device Detail</h2>
        <p className="text-muted-foreground">Loading device detail...</p>
      </div>
    )
  }

  const device = data as any

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{device.name}</h2>
        <p className="text-muted-foreground">{device.phone_number || 'No phone number connected yet.'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent className="capitalize">{device.status}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Health Score</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold">{device.health_score}</p>
            <Progress value={device.health_score} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Warmup</CardTitle></CardHeader>
          <CardContent>{device.warmup_day}/{device.warmup_target_day}</CardContent>
        </Card>
      </div>

      {device.qrCode || device.qr_code ? (
        <Card>
          <CardHeader><CardTitle>QR Code</CardTitle></CardHeader>
          <CardContent>
            <img src={device.qrCode || device.qr_code} alt="QR code" className="h-56 w-56 rounded-lg border object-contain" />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Health Rules</CardTitle></CardHeader>
        <CardContent>
          <RuleCheckList rules={(device.healthBreakdown?.breakdown || []).map((rule: any) => ({
            name: rule.rule,
            passed: rule.passed,
            detail: rule.detail,
          }))} />
        </CardContent>
      </Card>
    </div>
  )
}
