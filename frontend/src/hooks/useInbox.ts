'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Conversation, Message } from '@/types'

interface ConversationsParams {
  cursor?: string
  limit?: number
  status?: string
  assignedTo?: string
  search?: string
  enabled?: boolean
}

function buildConversationQuery(params: ConversationsParams = {}) {
  const query = new URLSearchParams()

  if (params.cursor) query.set('cursor', params.cursor)
  if (params.limit) query.set('limit', params.limit.toString())
  if (params.status) query.set('status', params.status)
  if (params.assignedTo) query.set('assignedTo', params.assignedTo)
  if (params.search) query.set('search', params.search)

  return query.toString()
}

export function useConversations(params: ConversationsParams = {}) {
  const { enabled = true, ...queryParams } = params

  return useQuery({
    queryKey: ['conversations', queryParams],
    enabled,
    queryFn: async () => {
      const query = buildConversationQuery(queryParams)
      const { data } = await api.get(`/inbox/conversations?${query}`)
      return data
    },
    refetchInterval: 30000,
  })
}

export function useInboxUnreadCount() {
  const pathname = usePathname()
  const isInboxPage = pathname === '/inbox'

  const inboxConversationsQuery = useConversations({
    limit: 50,
    enabled: isInboxPage,
  })

  const unreadFromInboxPage = useMemo(() => {
    const conversations = inboxConversationsQuery.data?.data || []
    return conversations.reduce(
      (sum: number, conversation: any) => sum + (conversation.unread_count || 0),
      0,
    )
  }, [inboxConversationsQuery.data])

  const unreadCountQuery = useQuery({
    queryKey: ['conversations', 'unread-count'],
    enabled: !isInboxPage,
    queryFn: async () => {
      let cursor: string | undefined
      let totalUnread = 0
      let hasMore = true
      let pagesRead = 0

      while (hasMore && pagesRead < 100) {
        const query = buildConversationQuery({ cursor, limit: 100 })
        const { data } = await api.get(`/inbox/conversations?${query}`)
        const conversations = data.data || []

        totalUnread += conversations.reduce(
          (sum: number, conversation: any) => sum + (conversation.unread_count || 0),
          0,
        )

        cursor = data.meta?.nextCursor || undefined
        hasMore = Boolean(data.meta?.hasMore && cursor)
        pagesRead += 1
      }

      return totalUnread
    },
  })

  if (isInboxPage) {
    return {
      data: unreadFromInboxPage,
      isLoading: inboxConversationsQuery.isLoading,
      isFetching: inboxConversationsQuery.isFetching,
      error: inboxConversationsQuery.error,
    }
  }

  return unreadCountQuery
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const { data } = await api.get(`/inbox/conversations/${conversationId}/messages?limit=100`)
      return data.data as Message[]
    },
    enabled: !!conversationId,
    refetchInterval: false,
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      conversationId: string
      deviceId: string
      content: string
      mediaUrl?: string
      type?: string
    }) => {
      const { data } = await api.post('/inbox/send', params)
      return data.data
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['messages', vars.conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useUpdateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Conversation>) => {
      const { data } = await api.patch(`/inbox/conversations/${id}`, updates)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}
