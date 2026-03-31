import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { MessageTemplate } from '@/types'
import type {
  TemplateDeleteResponse,
  TemplateGenerateResponse,
  TemplateResponse,
  TemplatesResponse,
} from '@/types/api.types'

interface TemplatesParams {
  cursor?: string
  limit?: number
  category?: string
  type?: string
  tags?: string[]
}

export function useTemplates(params: TemplatesParams = {}) {
  return useQuery({
    queryKey: ['templates', params],
    queryFn: async () => {
      const query = new URLSearchParams()
      if (params.cursor) query.set('cursor', params.cursor)
      if (params.limit) query.set('limit', params.limit.toString())
      if (params.category) query.set('category', params.category)
      if (params.type) query.set('type', params.type)
      if (params.tags?.length) query.set('tags', params.tags.join(','))
      
      const { data } = await api.get<TemplatesResponse>(`/templates?${query}`)
      return data
    },
  })
}

export function useCreateTemplate() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (template: Partial<MessageTemplate>) => {
      const { data } = await api.post<TemplateResponse>('/templates', {
        ...template,
        isAiGenerated: template.is_ai_generated,
      })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<MessageTemplate>) => {
      const { data } = await api.patch<TemplateResponse>(`/templates/${id}`, {
        ...updates,
        isAiGenerated: updates.is_ai_generated,
      })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data } = await api.delete<TemplateDeleteResponse>(`/templates/${templateId}`)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}

export function useAIGenerateTemplate() {
  return useMutation({
    mutationFn: async (params: { 
      description: string
      category?: string
      language?: string
      tone?: string 
    }) => {
      const { data } = await api.post<TemplateGenerateResponse>('/templates/ai-generate', params)
      const result = data.data
      const knownGateNames = [
        'Spam Patterns',
        'Emoji Density',
        'Opening Pattern',
        'Length Match',
        'Similarity Check',
      ]
      const normalizedGates = result.gates ?? knownGateNames.map((name, index) => {
        const gateNumber = index + 1
        const failure = result.gatesFailed.find((item) => item.startsWith(`Gate ${gateNumber}:`))

        return {
          name,
          passed: !failure,
          reason: failure?.replace(`Gate ${gateNumber}: `, ''),
        }
      })

      return {
        ...result,
        template: result.template ?? {
          name: result.name,
          body: result.body,
          variables: result.variables,
          category: params.category as MessageTemplate['category'] | undefined,
          type: 'text',
          tags: [],
        },
        gates: normalizedGates,
      }
    },
  })
}
