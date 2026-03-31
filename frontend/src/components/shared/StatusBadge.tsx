import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
  showDot?: boolean
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; tone: string }> = {
  connected: {
    label: 'Connected',
    dot: 'bg-emerald-500',
    tone: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  disconnected: {
    label: 'Disconnected',
    dot: 'bg-slate-400',
    tone: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  },
  qr_pending: {
    label: 'QR Pending',
    dot: 'bg-amber-500',
    tone: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
  error: {
    label: 'Error',
    dot: 'bg-red-500',
    tone: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  },
  warmup: {
    label: 'Warmup',
    dot: 'bg-orange-500',
    tone: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  },
  warming: {
    label: 'Warmup',
    dot: 'bg-orange-500',
    tone: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  },
  connecting: {
    label: 'Connecting',
    dot: 'bg-sky-500',
    tone: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  },
  banned: {
    label: 'Banned',
    dot: 'bg-red-500',
    tone: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  },
  paused: {
    label: 'Paused',
    dot: 'bg-yellow-500',
    tone: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200',
  },
  running: {
    label: 'Running',
    dot: 'bg-blue-500',
    tone: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  },
  draft: {
    label: 'Draft',
    dot: 'bg-slate-400',
    tone: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  },
  scheduled: {
    label: 'Scheduled',
    dot: 'bg-indigo-500',
    tone: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-emerald-500',
    tone: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  stopped: {
    label: 'Stopped',
    dot: 'bg-rose-500',
    tone: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  },
  failed: {
    label: 'Failed',
    dot: 'bg-rose-500',
    tone: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  },
  sent: {
    label: 'Sent',
    dot: 'bg-emerald-500',
    tone: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  delivered: {
    label: 'Delivered',
    dot: 'bg-sky-500',
    tone: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  },
  read: {
    label: 'Read',
    dot: 'bg-blue-500',
    tone: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  },
  active: {
    label: 'Active',
    dot: 'bg-teal-500',
    tone: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  },
  open: {
    label: 'Open',
    dot: 'bg-sky-500',
    tone: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  },
  resolved: {
    label: 'Resolved',
    dot: 'bg-emerald-500',
    tone: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  pending: {
    label: 'Pending',
    dot: 'bg-amber-500',
    tone: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
  opted_out: {
    label: 'Opted Out',
    dot: 'bg-rose-500',
    tone: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  },
  invalid: {
    label: 'Invalid',
    dot: 'bg-zinc-500',
    tone: 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200',
  },
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
} as const

const dotSizes = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
} as const

export function StatusBadge({
  status,
  className,
  showDot = true,
  size = 'md',
  showText = true,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status.replace(/_/g, ' '),
    dot: 'bg-slate-400',
    tone: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        sizeClasses[size],
        config.tone,
        className,
      )}
    >
      {showDot ? <span className={cn('rounded-full', dotSizes[size], config.dot)} /> : null}
      {showText ? config.label : null}
    </span>
  )
}
