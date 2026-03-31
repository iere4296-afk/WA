import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type {
  DeviceConnectResponse,
  DeviceCreateResponse,
  DeviceDeleteResponse,
  DeviceDisconnectResponse,
  DeviceResponse,
  DevicesResponse,
} from '@/types/api.types'
import { Device } from '@/types'

interface DevicesParams {
  cursor?: string
  limit?: number
  status?: string
}

function buildDevicesQuery(params: DevicesParams = {}) {
  const query = new URLSearchParams()

  if (params.cursor) query.set('cursor', params.cursor)
  if (params.limit) query.set('limit', params.limit.toString())
  if (params.status) query.set('status', params.status)

  return query.toString()
}

export function useDevices(params: DevicesParams = {}) {
  return useQuery({
    queryKey: ['devices', params],
    queryFn: async () => {
      const query = buildDevicesQuery(params)
      const { data } = await api.get<DevicesResponse>(`/devices?${query}`)
      return data
    },
  })
}

export function useDevice(id?: string | null) {
  return useQuery({
    queryKey: ['devices', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get<DeviceResponse>(`/devices/${id}`)
      return data.data
    },
  })
}

export function useAddDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (device: {
      name: string
      phoneNumber?: string
      dailyLimit?: number
      proxyUrl?: string
      webhookUrl?: string
      notes?: string
    }) => {
      const { data } = await api.post<DeviceCreateResponse>('/devices', device)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}

export const useCreateDevice = useAddDevice

export function useConnectDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (deviceId: string) => {
      const { data } = await api.post<DeviceConnectResponse>(`/devices/${deviceId}/connect`)
      return data.data
    },
    onSuccess: (_, deviceId) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      queryClient.invalidateQueries({ queryKey: ['devices', deviceId] })
    },
  })
}

export function useDisconnectDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (deviceId: string) => {
      const { data } = await api.post<DeviceDisconnectResponse>(`/devices/${deviceId}/disconnect`)
      return data.data
    },
    onSuccess: (_, deviceId) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      queryClient.invalidateQueries({ queryKey: ['devices', deviceId] })
    },
  })
}

export function useUpdateDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Device>) => {
      const { data } = await api.patch<DeviceResponse>(`/devices/${id}`, updates)
      return data.data
    },
    onSuccess: (device) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      queryClient.invalidateQueries({ queryKey: ['devices', device.id] })
    },
  })
}

export function useDeleteDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (deviceId: string) => {
      const { data } = await api.delete<DeviceDeleteResponse>(`/devices/${deviceId}`)
      return data.data
    },
    onSuccess: (_, deviceId) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      queryClient.removeQueries({ queryKey: ['devices', deviceId] })
    },
  })
}
