import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  ConversationResponse,
  ConversationsResponse,
  SendMessageResponse,
  ThreadMessagesResponse,
} from '@/types/api.types'
import type { Conversation, Message } from '@/types'

interface ConversationsParams {
  cursor?: string
  limit?: number
  status?: string
  assignedTo?: string
  search?: string
}

interface ConversationMessagesParams {
  conversationId?: string | null
  cursor?: string
  limit?: number
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
  return useQuery({
    queryKey: ['conversations', params],
    queryFn: async () => {
      const query = buildConversationQuery(params)
      const { data } = await api.get<ConversationsResponse>(`/inbox/conversations?${query}`)
      return data
    },
    refetchInterval: 30000,
  })
}

export function useConversation(conversationId?: string | null) {
  return useQuery({
    queryKey: ['conversations', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data } = await api.get<ConversationResponse>(`/inbox/conversations/${conversationId}`)
      return data.data
    },
  })
}

export function useMessages({ conversationId, cursor, limit = 30 }: ConversationMessagesParams) {
  return useQuery({
    queryKey: ['messages', conversationId, cursor, limit],
    enabled: !!conversationId,
    queryFn: async () => {
      const query = new URLSearchParams()
      query.set('limit', String(limit))
      if (cursor) query.set('cursor', cursor)

      const { data } = await api.get<ThreadMessagesResponse>(
        `/inbox/conversations/${conversationId}/messages?${query.toString()}`,
      )
      return data
    },
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
      type?: 'text' | 'image' | 'video' | 'document'
    }) => {
      const { data } = await api.post<SendMessageResponse>('/inbox/send', params)
      return data.data
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['messages', payload.conversationId] })

      const previousMessages = queryClient.getQueriesData<ThreadMessagesResponse | Message[]>({
        queryKey: ['messages', payload.conversationId],
      })

      const optimisticMessage: Message = {
        id: `optimistic-${Date.now()}`,
        conversation_id: payload.conversationId,
        content: payload.content,
        direction: 'outbound',
        status: 'pending',
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        type: payload.mediaUrl ? 'image' : (payload.type || 'text'),
        media_url: payload.mediaUrl,
      }

      queryClient.setQueriesData<ThreadMessagesResponse | Message[]>(
        { queryKey: ['messages', payload.conversationId] },
        (old) => {
          if (Array.isArray(old)) {
            return [...old, optimisticMessage]
          }

          if (old && Array.isArray(old.data)) {
            return {
              ...old,
              data: [...old.data, optimisticMessage],
            }
          }

          return {
            data: [optimisticMessage],
            meta: {
              nextCursor: null,
              hasMore: false,
            },
          }
        },
      )

      return { previousMessages }
    },
    onError: (_error, payload, context) => {
      context?.previousMessages?.forEach(([queryKey, previousData]) => {
        queryClient.setQueryData(queryKey, previousData)
      })
      console.error('Send message error:', payload.conversationId)
    },
    onSuccess: (_message, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useUpdateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Conversation>) => {
      const { data } = await api.patch<ConversationResponse>(`/inbox/conversations/${id}`, updates)
      return data.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.id] })
    },
  })
}
