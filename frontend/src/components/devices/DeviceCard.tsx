'use client'

import { MoreVertical, Plug, Power, ShieldAlert, Smartphone, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatPhone } from '@/lib/utils'
import { Device } from '@/types'

interface DeviceCardProps {
  device: Device
  onOpen: () => void
  onConnect: () => void
  onDisconnect: () => void
  onDelete: () => void
  busyAction?: 'connect' | 'disconnect' | 'delete' | null
}

function HealthRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const tone = clamped >= 80 ? '#16a34a' : clamped >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative h-16 w-16">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-950">
        {clamped}
      </div>
    </div>
  )
}

export function DeviceCard({
  device,
  onOpen,
  onConnect,
  onDisconnect,
  onDelete,
  busyAction = null,
}: DeviceCardProps) {
  const isDisconnected = device.status === 'disconnected'

  return (
    <Card
      className="cursor-pointer border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
              <Smartphone className="h-5 w-5 text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-950">{device.name}</p>
              <p className="truncate text-sm text-slate-500">{formatPhone(device.phone_number)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
            <StatusBadge status={device.status} size="sm" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Manage ${device.name}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isDisconnected ? (
                  <DropdownMenuItem onSelect={(event) => { event.preventDefault(); onConnect() }} disabled={busyAction === 'connect'}>
                    <Plug className="mr-2 h-4 w-4" />
                    Connect
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={(event) => { event.preventDefault(); onDisconnect() }} disabled={busyAction === 'disconnect'}>
                    <Power className="mr-2 h-4 w-4" />
                    Disconnect
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onSelect={(event) => { event.preventDefault(); onDelete() }}
                  disabled={busyAction === 'delete'}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="space-y-3 text-sm text-slate-600">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Daily Limit</p>
              <p className="mt-1 font-medium text-slate-900">
                {device.messages_sent_today.toLocaleString()} / {device.daily_limit.toLocaleString()} sent today
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Warmup</p>
              <p className="mt-1 flex items-center gap-2 font-medium text-slate-900">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                Day {device.warmup_day} of {device.warmup_target_day}
              </p>
            </div>
          </div>

          <div className="text-center">
            <HealthRing value={device.health_score} />
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Health</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
