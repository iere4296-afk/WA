import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  FlowResponse,
  FlowsResponse,
  FlowStepsResponse,
} from '@/types/api.types'
import type { Flow, FlowStep } from '@/types'

interface FlowsParams {
  cursor?: string
  limit?: number
}

function buildFlowsQuery(params: FlowsParams = {}) {
  const query = new URLSearchParams()

  if (params.cursor) query.set('cursor', params.cursor)
  if (params.limit) query.set('limit', params.limit.toString())

  return query.toString()
}

export function useFlows(params: FlowsParams = {}) {
  return useQuery({
    queryKey: ['flows', params],
    queryFn: async () => {
      const query = buildFlowsQuery(params)
      const { data } = await api.get<FlowsResponse>(`/flows?${query}`)
      return data
    },
  })
}

export function useFlow(id?: string) {
  return useQuery({
    queryKey: ['flows', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get<FlowResponse>(`/flows/${id}`)
      return data.data
    },
  })
}

export function useCreateFlow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      name: string
      description?: string
      triggerType: Flow['trigger_type']
      status?: Flow['status']
    }) => api.post<FlowResponse>('/flows', body).then((response) => response.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  })
}

export function useUpdateFlow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<{
      name: string
      description?: string
      triggerType: Flow['trigger_type']
      status?: Flow['status']
    }>) => api.patch<FlowResponse>(`/flows/${id}`, body).then((response) => response.data.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['flows'] })
      qc.invalidateQueries({ queryKey: ['flows', variables.id] })
    },
  })
}

export function useSaveFlowSteps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ flowId, steps }: { flowId: string; steps: Array<{
      id?: string
      name: string
      delayHours: number
      type: FlowStep['type']
      templateId?: string
      aiPrompt?: string
      conditionRules: Record<string, unknown>
    }> }) =>
      api.post<FlowStepsResponse>(`/flows/${flowId}/steps`, { steps }).then((response) => response.data.data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['flows', vars.flowId] }),
  })
}

export function useDeleteFlow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/flows/${id}`).then((response) => response.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  })
}

export function useEnrollContacts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ flowId, contactIds }: { flowId: string; contactIds: string[] }) =>
      api.post(`/flows/${flowId}/enroll`, { contactIds }).then((response) => response.data.data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['flows', vars.flowId] }),
  })
}
