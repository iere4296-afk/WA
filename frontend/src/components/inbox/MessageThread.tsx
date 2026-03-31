'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Clock3 } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { EmptyState } from '@/components/shared/EmptyState'
import { Message } from '@/types'
import { cn, formatRelativeTime } from '@/lib/utils'

interface MessageThreadProps {
  messages: Message[]
  loading?: boolean
  loadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
}

function formatSeparatorLabel(value: string) {
  const date = new Date(value)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d, yyyy')
}

function getMessageStatusMark(status?: string | null) {
  if (status === 'read' || status === 'delivered') return '✓✓'
  if (status === 'sent') return '✓'
  if (status === 'queued' || status === 'pending' || status === 'sending') return '⏱'
  return ''
}

export function MessageThread({
  messages,
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
}: MessageThreadProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const previousCountRef = useRef(0)
  const previousScrollHeightRef = useRef<number | null>(null)

  const timeline = useMemo(() => {
    const items: Array<{ type: 'separator'; label: string } | { type: 'message'; message: Message }> = []
    let currentDate = ''

    messages.forEach((message) => {
      const dateKey = new Date(message.created_at).toISOString().slice(0, 10)
      if (dateKey !== currentDate) {
        currentDate = dateKey
        items.push({ type: 'separator', label: formatSeparatorLabel(message.created_at) })
      }
      items.push({ type: 'message', message })
    })

    return items
  }, [messages])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const previousCount = previousCountRef.current
    const nextCount = messages.length
    const wasNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 140

    if (previousScrollHeightRef.current !== null && !loadingMore) {
      const heightDelta = container.scrollHeight - previousScrollHeightRef.current
      container.scrollTop += heightDelta
      previousScrollHeightRef.current = null
    } else if (nextCount > previousCount && (previousCount === 0 || wasNearBottom)) {
      container.scrollTop = container.scrollHeight
    }

    previousCountRef.current = nextCount
  }, [loadingMore, messages])

  function handleScroll() {
    const container = containerRef.current
    if (!container || !hasMore || loadingMore || !onLoadMore) return

    if (container.scrollTop < 80) {
      previousScrollHeightRef.current = container.scrollHeight
      onLoadMore()
    }
  }

  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 space-y-3 overflow-y-auto rounded-3xl border border-slate-200 bg-[#efeae2] p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'h-16 animate-pulse rounded-2xl bg-white/80',
              index % 2 === 0 ? 'mr-auto w-2/3' : 'ml-auto w-1/2',
            )}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto rounded-3xl border border-slate-200 bg-[#efeae2] p-4"
    >
      {loadingMore ? (
        <div className="pb-3 text-center text-xs font-medium text-slate-500">Loading older messages...</div>
      ) : null}

      {timeline.length > 0 ? (
        <div className="space-y-3">
          {timeline.map((item, index) => {
            if (item.type === 'separator') {
              return (
                <div key={`${item.label}-${index}`} className="flex justify-center">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                    {item.label}
                  </span>
                </div>
              )
            }

            const message = item.message
            const isOutbound = String((message as any).direction || '').toLowerCase() === 'outbound'
            const time = message.sent_at || message.created_at
            const statusMark = getMessageStatusMark((message as any).status)

            return (
              <div key={message.id} className={cn('mb-2 flex', isOutbound ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[70%] rounded-2xl px-4 py-2 shadow-sm',
                    isOutbound ? 'rounded-br-sm bg-[#25D366] text-white' : 'rounded-bl-sm bg-white text-gray-900',
                  )}
                >
                  <p className="break-words whitespace-pre-wrap text-sm">{message.content || 'Media message'}</p>

                  {message.type === 'image' && message.media_url ? (
                    <img
                      src={message.media_url}
                      alt="Media"
                      className="mt-1 max-w-full rounded-lg"
                    />
                  ) : null}

                  <div className={cn('mt-1 flex items-center gap-1', isOutbound ? 'justify-end' : 'justify-start')}>
                    <span className={cn('text-xs', isOutbound ? 'text-green-100' : 'text-gray-400')}>
                      {time ? formatRelativeTime(time) : ''}
                    </span>
                    {isOutbound && statusMark ? (
                      <span className="text-xs text-green-100">{statusMark}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            icon={Clock3}
            title="No messages yet"
            description="Messages in this conversation will appear here in realtime."
          />
        </div>
      )}
    </div>
  )
}
