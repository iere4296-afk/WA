import { useQuery } from '@tanstack/react-query'
import { eachDayOfInterval, endOfDay, isAfter } from 'date-fns'
import api from '@/lib/api'
import { AnalyticsSummary } from '@/types'
import type {
  AnalyticsCampaignComparisonResponse,
  AnalyticsDevicePerformanceResponse,
  AnalyticsFunnelResponse,
  AnalyticsOverviewPayload,
  AnalyticsVolumeResponse,
  HealthEventsResponse,
} from '@/types/api.types'

interface AnalyticsParams {
  start?: string
  end?: string
  deviceId?: string
}

export interface AnalyticsHealthHistoryPoint {
  date: string
  [deviceName: string]: string | number
}

function buildAnalyticsQuery(params: AnalyticsParams = {}) {
  const query = new URLSearchParams()

  if (params.start) query.set('start', params.start)
  if (params.end) query.set('end', params.end)
  if (params.deviceId) query.set('deviceId', params.deviceId)

  return query.toString()
}

function getDateRange(params: AnalyticsParams = {}) {
  const end = params.end ? new Date(params.end) : new Date()
  const start = params.start
    ? new Date(params.start)
    : new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)

  return { start, end }
}

export function useAnalyticsSummary(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'summary', params],
    queryFn: async () => {
      const query = buildAnalyticsQuery(params)
      const { data } = await api.get(`/analytics/summary?${query}`)
      return data.data as AnalyticsSummary
    },
  })
}

export function useAnalyticsOverview(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'overview', params],
    queryFn: async () => {
      const query = buildAnalyticsQuery(params)
      const { data } = await api.get(`/analytics/overview?${query}`)
      return data.data as AnalyticsOverviewPayload
    },
  })
}

export function useAnalyticsVolume(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'volume', params],
    queryFn: async () => {
      const query = buildAnalyticsQuery(params)
      const { data } = await api.get<AnalyticsVolumeResponse>(`/analytics/volume?${query}`)
      return data.data
    },
  })
}

export function useAnalyticsFunnel(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'funnel', params],
    queryFn: async () => {
      const query = buildAnalyticsQuery(params)
      const { data } = await api.get<AnalyticsFunnelResponse>(`/analytics/funnel?${query}`)
      return data.data
    },
  })
}

export function useAnalyticsCampaignComparison(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'campaigns', params],
    queryFn: async () => {
      const query = buildAnalyticsQuery(params)
      const { data } = await api.get<AnalyticsCampaignComparisonResponse>(`/analytics/campaigns?${query}`)
      return data.data
    },
  })
}

export function useDeviceAnalytics(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'devices', params],
    queryFn: async () => {
      const query = buildAnalyticsQuery(params)
      const { data } = await api.get<AnalyticsDevicePerformanceResponse>(`/analytics/devices?${query}`)
      return data.data
    },
  })
}

export function useAnalyticsHealthHistory(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'health-history', params],
    queryFn: async () => {
      const query = buildAnalyticsQuery(params)
      const [{ data: deviceResponse }, { data: eventResponse }] = await Promise.all([
        api.get<AnalyticsDevicePerformanceResponse>(`/analytics/devices?${query}`),
        api.get<HealthEventsResponse>('/anti-ban/events'),
      ])

      const devices = (deviceResponse.data || []).filter((device) =>
        params.deviceId ? device.id === params.deviceId : true,
      )

      const { start, end } = getDateRange(params)
      const allEvents = (eventResponse.data || []).filter((event) => {
        const createdAt = new Date(event.created_at)
        return createdAt >= start && createdAt <= end
      })

      const penaltyBySeverity = {
        info: 2,
        warning: 5,
        critical: 9,
      } as const

      const points: AnalyticsHealthHistoryPoint[] = eachDayOfInterval({ start, end }).map((date) => {
        const point: AnalyticsHealthHistoryPoint = {
          date: date.toISOString().slice(0, 10),
        }

        devices.forEach((device) => {
          const eventsAfterBucket = allEvents.filter(
            (event) => event.device_id === device.id && isAfter(new Date(event.created_at), endOfDay(date)),
          )

          const recoveredScore = Math.min(
            100,
            Math.max(
              0,
              device.health_score + eventsAfterBucket.reduce(
                (sum, event) => sum + penaltyBySeverity[event.severity],
                0,
              ),
            ),
          )

          point[device.name] = recoveredScore
        })

        return point
      })

      return {
        devices,
        points,
      }
    },
  })
}
