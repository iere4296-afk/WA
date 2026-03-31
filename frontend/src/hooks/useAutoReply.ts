import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  AutoReplyRuleResponse,
  AutoReplyRulesResponse,
} from '@/types/api.types'
import type { AutoReplyRule } from '@/types'

export function useAutoReply() {
  return useQuery({
    queryKey: ['auto-reply'],
    queryFn: async () => {
      const { data } = await api.get<AutoReplyRulesResponse>('/auto-reply')
      return data.data
    },
  })
}

export function useCreateAutoReplyRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      name: string
      triggerType: AutoReplyRule['trigger_type']
      matchType: AutoReplyRule['match_type']
      keywords: string[]
      responseType: AutoReplyRule['response_type']
      responseMessage?: string
      templateId?: string
      aiSystemPrompt?: string
      cooldownMinutes: number
      priority: number
      isActive: boolean
    }) => api.post<AutoReplyRuleResponse>('/auto-reply', body).then((response) => response.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-reply'] }),
  })
}

export function useUpdateAutoReplyRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<{
      name: string
      triggerType: AutoReplyRule['trigger_type']
      matchType: AutoReplyRule['match_type']
      keywords: string[]
      responseType: AutoReplyRule['response_type']
      responseMessage?: string
      templateId?: string
      aiSystemPrompt?: string
      cooldownMinutes: number
      priority: number
      isActive: boolean
    }>) => api.patch<AutoReplyRuleResponse>(`/auto-reply/${id}`, body).then((response) => response.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-reply'] }),
  })
}

export function useDeleteAutoReplyRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/auto-reply/${id}`).then((response) => response.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-reply'] }),
  })
}
