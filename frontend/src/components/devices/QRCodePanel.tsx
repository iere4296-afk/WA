'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, QrCode, RefreshCcw } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import api from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useConnectDevice } from '@/hooks/useDevices'
import type { Device } from '@/types'
import type { DeviceQrResponse } from '@/types/api.types'

interface QRCodePanelProps {
  deviceId: string
  initialQrCode?: string | null
  initialStatus?: Device['status']
}

export function QRCodePanel({ deviceId, initialQrCode = null, initialStatus = 'disconnected' }: QRCodePanelProps) {
  const queryClient = useQueryClient()
  const connectDevice = useConnectDevice()
  const [qrCode, setQrCode] = useState<string | null>(initialQrCode)
  const [status, setStatus] = useState<Device['status']>(initialStatus)
  const [countdown, setCountdown] = useState(initialQrCode ? 60 : 0)

  const qrQuery = useQuery({
    queryKey: ['devices', deviceId, 'qr'],
    enabled: !!deviceId,
    queryFn: async () => {
      const response = await api.get<DeviceQrResponse>(`/devices/${deviceId}/qr`)
      return response.data.data
    },
  })

  useEffect(() => {
    if (!qrQuery.data) return
    setQrCode(qrQuery.data.qrCode ?? null)
    setStatus(qrQuery.data.status)
  }, [qrQuery.data])

  useEffect(() => {
    if (status === 'connected') {
      setCountdown(0)
      return
    }

    if (qrCode) {
      setCountdown(60)
    }
  }, [qrCode, status])

  useEffect(() => {
    if (!qrCode || status === 'connected') return

    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [qrCode, status])

  useEffect(() => {
    if (!deviceId) return

    const channel = supabase
      .channel(`device-qr:${deviceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_devices',
          filter: `id=eq.${deviceId}`,
        },
        (payload) => {
          const nextRow = payload.new as Partial<Device>
          setQrCode(nextRow.qr_code ?? null)
          setStatus((nextRow.status as Device['status']) ?? initialStatus)
          queryClient.invalidateQueries({ queryKey: ['devices'] })
          queryClient.invalidateQueries({ queryKey: ['devices', deviceId] })
          queryClient.invalidateQueries({ queryKey: ['devices', deviceId, 'qr'] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [deviceId, initialStatus, queryClient])

  async function handleRefresh() {
    try {
      await connectDevice.mutateAsync(deviceId)
      setStatus('connecting')
      toast.success('QR refresh requested. Waiting for a fresh code...')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to refresh QR code.')
    }
  }

  if (status === 'connected') {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-emerald-900">Connected!</p>
            <p className="text-sm text-emerald-700">
              This device is already paired and ready to send messages.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Live QR Pairing</p>
          <p className="mt-1 text-sm text-slate-600">
            Scan this code in WhatsApp. A new code expires every 60 seconds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <span className="text-sm font-medium text-slate-600">
            {qrCode && countdown > 0 ? `${countdown}s` : 'Waiting'}
          </span>
        </div>
      </div>

      <div className="flex min-h-80 items-center justify-center rounded-[2rem] border border-dashed border-slate-300 bg-white p-6">
        {qrQuery.isLoading && !qrCode ? (
          <div className="h-56 w-56 animate-pulse rounded-3xl bg-slate-100" />
        ) : qrCode ? (
          <div className="space-y-4 text-center">
            <img
              src={qrCode}
              alt="WhatsApp device QR code"
              className="mx-auto h-56 w-56 rounded-3xl border border-slate-200 bg-white object-contain p-3 shadow-sm"
            />
            <p className="text-sm text-slate-600">
              {countdown > 0
                ? `This QR code expires in ${countdown} seconds.`
                : 'This QR code has expired. Refresh to generate a new one.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100">
              <QrCode className="h-8 w-8 text-slate-500" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Waiting for QR code</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Start or refresh the connection flow to generate a scannable QR code for this device.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => void handleRefresh()}
          disabled={connectDevice.isPending}
        >
          <RefreshCcw className="h-4 w-4" />
          {connectDevice.isPending ? 'Refreshing...' : 'Refresh QR'}
        </Button>
      </div>
    </div>
  )
}
