'use client'

import { useEffect, useMemo, useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { toast } from 'sonner'
import { ConversationList } from '@/components/inbox/ConversationList'
import { MessageInput } from '@/components/inbox/MessageInput'
import { MessageThread } from '@/components/inbox/MessageThread'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonPage } from '@/components/shared/SkeletonPage'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { api } from '@/lib/api'
import { getContactDisplayPhone, getInitials } from '@/lib/utils'
import { useConversation, useConversations, useMessages, useSendMessage } from '@/hooks/useMessages'
import { useConversationRealtime, useInboxUnreadRealtime } from '@/hooks/useRealtime'
import type { Conversation, Message } from '@/types'
import type { ThreadMessagesResponse } from '@/types/api.types'

function getConversationContact(conversation?: Conversation | null) {
  if (!conversation) return null
  return conversation.contacts || null
}

export default function InboxPage() {
  const conversationsQuery = useConversations({ limit: 50 })
  const conversations = conversationsQuery.data?.data || []
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [olderMessages, setOlderMessages] = useState<Message[]>([])
  const [olderCursor, setOlderCursor] = useState<string | undefined>(undefined)
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)

  const conversationQuery = useConversation(selectedConversationId)
  const latestMessagesQuery = useMessages({
    conversationId: selectedConversationId,
    limit: 30,
  })
  const sendMessage = useSendMessage()

  useConversationRealtime(selectedConversationId || undefined)
  useInboxUnreadRealtime()

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id)
    }
  }, [conversations, selectedConversationId])

  useEffect(() => {
    setOlderMessages([])
    setOlderCursor(undefined)
    setHasMoreOlderMessages(Boolean(latestMessagesQuery.data?.meta.hasMore))
  }, [selectedConversationId])

  useEffect(() => {
    setHasMoreOlderMessages(Boolean(latestMessagesQuery.data?.meta.hasMore))
    if (!olderCursor) {
      setOlderCursor(latestMessagesQuery.data?.meta.nextCursor || undefined)
    }
  }, [latestMessagesQuery.data, olderCursor])

  const messages = useMemo(() => {
    const combined = [...olderMessages, ...(latestMessagesQuery.data?.data || [])]
    const deduped = new Map<string, Message>()

    combined.forEach((message) => {
      deduped.set(message.id, message)
    })

    return Array.from(deduped.values()).sort(
      (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
    )
  }, [latestMessagesQuery.data, olderMessages])

  async function handleLoadOlderMessages() {
    if (!selectedConversationId || !olderCursor || loadingOlderMessages) return

    setLoadingOlderMessages(true)
    try {
      const query = new URLSearchParams()
      query.set('limit', '30')
      query.set('cursor', olderCursor)

      const response = await api.get<ThreadMessagesResponse>(
        `/inbox/conversations/${selectedConversationId}/messages?${query.toString()}`,
      )

      setOlderMessages((current) => [...response.data.data, ...current])
      setOlderCursor(response.data.meta.nextCursor || undefined)
      setHasMoreOlderMessages(Boolean(response.data.meta.hasMore && response.data.meta.nextCursor))
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to load older messages.')
    } finally {
      setLoadingOlderMessages(false)
    }
  }

  async function handleSendMessage(content: string) {
    if (!selectedConversation || !content.trim()) return

    const deviceId = selectedConversation.device_id || selectedConversation.whatsapp_devices?.id
    if (!deviceId) {
      toast.error('No device linked to this conversation. Please reconnect a device.')
      return
    }

    try {
      await sendMessage.mutateAsync({
        conversationId: selectedConversation.id,
        deviceId,
        content: content.trim(),
      })
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to send message.')
      throw error
    }
  }

  const selectedConversation = conversationQuery.data
    || conversations.find((conversation) => conversation.id === selectedConversationId)
    || null
  const selectedContact = getConversationContact(selectedConversation)
  const selectedDisplayPhone = getContactDisplayPhone(selectedContact)
  const selectedDeviceId = selectedConversation?.device_id || selectedConversation?.whatsapp_devices?.id || null

  if (conversationsQuery.isLoading && !conversationsQuery.data) {
    return <SkeletonPage rows={4} />
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] gap-4 xl:grid-cols-[360px_1fr]">
      <ConversationList
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        loading={conversationsQuery.isLoading}
      />

      <div className="flex min-h-0 flex-col gap-4">
        {selectedConversation ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {getInitials(selectedContact?.name || selectedDisplayPhone || 'C')}
                </div>
                <div>
                  <p className="font-medium text-slate-950">
                    {selectedContact?.name || selectedDisplayPhone || 'Unknown'}
                  </p>
                  <p className="font-mono text-sm text-slate-500">
                    {selectedDisplayPhone || 'Unknown'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusBadge status={selectedConversation.status} />
                {selectedConversation.unread_count > 0 ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                    {selectedConversation.unread_count} unread
                  </span>
                ) : null}
              </div>
            </div>

            <MessageThread
              messages={messages}
              loading={latestMessagesQuery.isLoading && messages.length === 0}
              loadingMore={loadingOlderMessages}
              hasMore={hasMoreOlderMessages}
              onLoadMore={() => void handleLoadOlderMessages()}
            />

            <div className="space-y-2">
              {!selectedDeviceId ? (
                <p className="text-center text-xs text-rose-500">
                  No device is linked to this conversation. Reconnect a device to reply.
                </p>
              ) : null}

              <MessageInput
                onSend={handleSendMessage}
                disabled={!selectedConversationId || !selectedDeviceId}
              />
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
            <EmptyState
              icon={MessageSquareText}
              title="Select a conversation"
              description="Choose a conversation from the left to load realtime WhatsApp history and reply."
            />
          </div>
        )}
      </div>
    </div>
  )
}
