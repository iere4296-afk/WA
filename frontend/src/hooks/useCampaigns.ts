import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Campaign } from '@/types'
import type {
  CampaignActionResponse,
  CampaignDeleteResponse,
  CampaignLaunchResponse,
  CampaignMessagesResponse,
  CampaignResponse,
  CampaignsResponse,
} from '@/types/api.types'

interface CampaignsParams {
  cursor?: string
  limit?: number
  status?: string
}

interface CampaignMessagesParams {
  campaignId: string
  cursor?: string
  limit?: number
}

function buildCampaignsQuery(params: CampaignsParams = {}) {
  const query = new URLSearchParams()

  if (params.cursor) query.set('cursor', params.cursor)
  if (params.limit) query.set('limit', params.limit.toString())
  if (params.status) query.set('status', params.status)

  return query.toString()
}

export function useCampaigns(params: CampaignsParams = {}) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: async () => {
      const query = buildCampaignsQuery(params)
      const { data } = await api.get<CampaignsResponse>(`/campaigns?${query}`)
      return data
    },
  })
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: async () => {
      const { data } = await api.get<CampaignResponse>(`/campaigns/${id}`)
      return data.data as Campaign & { liveStats?: Record<string, number> }
    },
    enabled: !!id,
  })
}

export function useCampaignMessages({ campaignId, cursor, limit = 25 }: CampaignMessagesParams) {
  return useQuery({
    queryKey: ['campaign-messages', campaignId, cursor, limit],
    enabled: !!campaignId,
    queryFn: async () => {
      const query = new URLSearchParams()
      query.set('campaignId', campaignId)
      query.set('limit', String(limit))
      if (cursor) query.set('cursor', cursor)

      const { data } = await api.get<CampaignMessagesResponse>(`/messages?${query.toString()}`)
      return data
    },
  })
}

export function useCreateCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaign: Partial<Campaign>) => {
      const { data } = await api.post<CampaignResponse>('/campaigns', campaign)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...campaign }: { id: string } & Partial<Campaign>) => {
      const { data } = await api.patch<CampaignResponse>(`/campaigns/${id}`, campaign)
      return data.data
    },
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaign.id] })
    },
  })
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data } = await api.delete<CampaignDeleteResponse>(`/campaigns/${campaignId}`)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useLaunchCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data } = await api.post<CampaignLaunchResponse>(`/campaigns/${campaignId}/launch`)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function usePauseCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data } = await api.post<CampaignActionResponse>(`/campaigns/${campaignId}/pause`)
      return data.data
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] })
    },
  })
}

export function useResumeCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data } = await api.post<CampaignActionResponse>(`/campaigns/${campaignId}/resume`)
      return data.data
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] })
    },
  })
}

export function useStopCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data } = await api.post<CampaignActionResponse>(`/campaigns/${campaignId}/stop`)
      return data.data
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] })
    },
  })
}
