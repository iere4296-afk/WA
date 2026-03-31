'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Conversation } from '@/types'
import { formatRelativeTime, getContactDisplayPhone, getInitials, truncate } from '@/lib/utils'

interface ConversationListProps {
  conversations: Conversation[]
  selectedConversationId?: string | null
  onSelectConversation: (conversationId: string) => void
  loading?: boolean
}

type ConversationFilter = 'all' | 'unread' | 'assigned'

function getConversationContact(conversation: Conversation) {
  return conversation.contacts || null
}

export function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  loading = false,
}: ConversationListProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ConversationFilter>('all')

  const filteredConversations = useMemo(() => {
    const searchValue = search.trim().toLowerCase()

    return conversations.filter((conversation) => {
      const contact = getConversationContact(conversation)
      const displayPhone = getContactDisplayPhone(contact)
      const matchesSearch = !searchValue
        || contact?.name?.toLowerCase().includes(searchValue)
        || displayPhone.toLowerCase().includes(searchValue)
        || conversation.last_message_preview?.toLowerCase().includes(searchValue)

      const matchesFilter = filter === 'all'
        || (filter === 'unread' && conversation.unread_count > 0)
        || (filter === 'assigned' && Boolean(conversation.assigned_to))

      return matchesSearch && matchesFilter
    })
  }, [conversations, filter, search])

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-950">Inbox</h2>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-10"
            placeholder="Search conversations"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'unread', label: 'Unread' },
            { key: 'assigned', label: 'Assigned' },
          ].map((option) => (
            <button
              key={option.key}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === option.key
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              onClick={() => setFilter(option.key as ConversationFilter)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : filteredConversations.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredConversations.map((conversation) => {
              const contact = getConversationContact(conversation)
              const displayPhone = getContactDisplayPhone(contact)
              return (
                <button
                  key={conversation.id}
                  className={`flex w-full gap-3 px-4 py-4 text-left transition hover:bg-slate-50 ${
                    selectedConversationId === conversation.id ? 'bg-emerald-50/70' : 'bg-white'
                  }`}
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {getInitials(contact?.name || displayPhone || 'C')}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-950">
                          {contact?.name || displayPhone || 'Unknown'}
                        </p>
                        <p className="truncate font-mono text-xs text-slate-500">
                          {contact?.name ? displayPhone : (displayPhone || contact?.name || 'Unknown')}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">
                        {conversation.last_message_at ? formatRelativeTime(conversation.last_message_at) : 'New'}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="truncate text-sm text-slate-500">
                        {truncate(conversation.last_message_preview || 'No messages yet', 46)}
                      </p>
                      {conversation.unread_count > 0 ? (
                        <Badge className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] text-white">
                          {conversation.unread_count}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
            No conversations match the current filters.
          </div>
        )}
      </div>
    </div>
  )
}
