import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  AntiBanDeviceResponse,
  AntiBanScoresResponse,
  HealthEventsResponse,
} from '@/types/api.types'

export function useAntiBanScores() {
  return useQuery({
    queryKey: ['anti-ban', 'scores'],
    queryFn: async () => {
      const { data } = await api.get<AntiBanScoresResponse>('/anti-ban/scores')
      return data.data
    },
    refetchInterval: 60_000,
  })
}

export function useAntiBanDevice(deviceId?: string | null) {
  return useQuery({
    queryKey: ['anti-ban', 'scores', deviceId],
    enabled: !!deviceId,
    queryFn: async () => {
      const { data } = await api.get<AntiBanDeviceResponse>(`/anti-ban/scores/${deviceId}`)
      return data.data
    },
  })
}

export function useAntiBanRules() {
  return useQuery({
    queryKey: ['anti-ban', 'rules'],
    queryFn: async () => {
      const { data } = await api.get('/anti-ban/rules')
      return data.data
    },
  })
}

export function useHealthEvents() {
  return useQuery({
    queryKey: ['anti-ban', 'events'],
    queryFn: async () => {
      const { data } = await api.get<HealthEventsResponse>('/anti-ban/events')
      return data.data
    },
  })
}

export function useRescoreDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (deviceId: string) => {
      const { data } = await api.post<AntiBanDeviceResponse>(`/anti-ban/rescore/${deviceId}`)
      return data.data
    },
    onSuccess: (_, deviceId) => {
      queryClient.invalidateQueries({ queryKey: ['anti-ban'] })
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      queryClient.invalidateQueries({ queryKey: ['devices', deviceId] })
      queryClient.invalidateQueries({ queryKey: ['analytics', 'devices'] })
    },
  })
}
