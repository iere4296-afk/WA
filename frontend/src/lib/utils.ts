import { clsx, type ClassValue } from "clsx"
import { format, formatDistanceToNow } from 'date-fns'
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhone(phone?: string | null): string {
  if (!phone) return 'Unknown'

  const clean = phone.trim()

  if (clean.includes('@')) {
    const base = clean.split('@')[0]?.replace(/\s+/g, '') || ''
    if (base.startsWith('+')) return base
    if (/^\d+$/.test(base)) return `+${base}`
    return base
  }

  const normalized = clean.replace(/\s+/g, '')

  if (normalized.startsWith('+')) {
    return normalized
  }

  if (/^\d+$/.test(normalized)) {
    return `+${normalized}`
  }

  return normalized
}

export function getContactDisplayPhone(contact?: {
  phone?: string | null
  custom_fields?: Record<string, any> | null
} | null): string {
  return formatPhone(
    contact?.custom_fields?.resolved_phone
    || contact?.custom_fields?.display_phone
    || contact?.phone
    || null,
  )
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return 'N/A'
  return format(new Date(value), 'MMM d, yyyy HH:mm')
}

export function formatRelativeTime(value?: string | Date | null): string {
  if (!value) return 'just now'
  return formatDistanceToNow(new Date(value), { addSuffix: true })
}

export function getInitials(value: string): string {
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U'
}

export function truncate(text: string, length: number = 50): string {
  if (!text) return ''
  return text.length > length ? `${text.slice(0, length)}...` : text
}

export function getStatusColor(status: string) {
  const palette: Record<string, { bg: string; text: string; dot: string }> = {
    connected: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
    disconnected: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
    connecting: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
    warming: { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
    banned: { bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-500' },
    paused: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
    running: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
    completed: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
    failed: { bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-500' },
    draft: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
    scheduled: { bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500' },
    active: { bg: 'bg-teal-100', text: 'text-teal-800', dot: 'bg-teal-500' },
    open: { bg: 'bg-sky-100', text: 'text-sky-800', dot: 'bg-sky-500' },
    resolved: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
    pending: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
    opted_out: { bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-500' },
    invalid: { bg: 'bg-zinc-100', text: 'text-zinc-700', dot: 'bg-zinc-400' },
  }

  return palette[status] || palette.draft
}
