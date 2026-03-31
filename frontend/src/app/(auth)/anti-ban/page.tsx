'use client'

import { useEffect, useMemo, useState } from 'react'
import { ShieldAlert, ShieldCheck, Siren } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonPage } from '@/components/shared/SkeletonPage'
import { BanPredictionWidget } from '@/components/anti-ban/BanPredictionWidget'
import { HealthScoreCard } from '@/components/anti-ban/HealthScoreCard'
import { RuleCheckList } from '@/components/anti-ban/RuleCheckList'
import { useAntiBanDevice, useAntiBanScores, useRescoreDevice } from '@/hooks/useAntiBan'
import { toast } from 'sonner'

function getRecommendation(riskLevel: 'low' | 'medium' | 'high') {
  if (riskLevel === 'high') {
    return 'Pause high-volume outbound activity, review recent opt-outs, and rescore after correcting failed rules.'
  }

  if (riskLevel === 'medium') {
    return 'Reduce send velocity slightly and resolve any failed delivery or scheduling rules before scaling up.'
  }

  return 'Maintain current warmup discipline and keep monitoring delivery and opt-out behavior.'
}

export default function AntiBanPage() {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const scoresQuery = useAntiBanScores()
  const rescoreMutation = useRescoreDevice()
  const devices = scoresQuery.data?.devices || []

  useEffect(() => {
    if (!selectedDeviceId && devices[0]?.id) {
      setSelectedDeviceId(devices[0].id)
    }
  }, [devices, selectedDeviceId])

  const selectedFromList = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) || null,
    [devices, selectedDeviceId],
  )

  const deviceDetailQuery = useAntiBanDevice(selectedDeviceId || selectedFromList?.id || null)
  const selectedDevice = deviceDetailQuery.data || selectedFromList

  const failedRules = selectedDevice?.breakdown?.filter((rule) => !rule.passed).length || 0

  async function handleRescore() {
    if (!selectedDevice?.id) return

    try {
      await rescoreMutation.mutateAsync(selectedDevice.id)
      toast.success('Device health was rescored from the live anti-ban engine')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to rescore the selected device')
    }
  }

  if (scoresQuery.isLoading && devices.length === 0) {
    return <SkeletonPage rows={5} />
  }

  if (devices.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No devices available"
        description="Add a WhatsApp device first. Anti-ban analytics and the 80-rule checklist only appear for real devices."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Anti-Ban</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review each device’s 0-100 health score, risk probability, and full 80-rule anti-ban checklist.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedDevice?.id || ''}
            onChange={(event) => setSelectedDeviceId(event.target.value)}
            className="h-9 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
          >
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>

          <Button variant="outline" onClick={() => void handleRescore()} disabled={rescoreMutation.isPending}>
            {rescoreMutation.isPending ? 'Rescoring...' : 'Rescore device'}
          </Button>
        </div>
      </div>

      {selectedDevice ? (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <HealthScoreCard
              score={selectedDevice.score}
              rulesPassed={selectedDevice.rulesPassed}
              rulesTotal={selectedDevice.rulesTotal}
            />

            <BanPredictionWidget
              probability={selectedDevice.banProbability}
              riskLevel={selectedDevice.riskLevel}
              topFactors={selectedDevice.topFactors}
              recommendation={getRecommendation(selectedDevice.riskLevel)}
            />

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="grid h-full gap-4 p-6">
                <div>
                  <p className="text-sm text-slate-500">Device status</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{selectedDevice.status}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Siren className="h-4 w-4 text-rose-500" />
                      Failed rules
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-slate-950">{failedRules}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                      Risk events (24h)
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-slate-950">
                      {selectedDevice.optOuts24h + selectedDevice.banSignals24h}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <RuleCheckList
            rules={(selectedDevice.breakdown || []).map((rule) => ({
              name: rule.rule,
              passed: rule.passed,
              detail: rule.detail,
              category: rule.category,
            }))}
          />
        </>
      ) : (
        <EmptyState
          icon={ShieldAlert}
          title="Select a device"
          description="Choose a device from the dropdown to inspect its anti-ban score, risk model, and rule checklist."
        />
      )}
    </div>
  )
}
