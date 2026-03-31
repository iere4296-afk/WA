import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useOrg } from './useOrg'
import { toast } from 'sonner'

function useResolvedOrgId(explicitOrgId?: string | null) {
  const { orgId } = useOrg()
  return explicitOrgId ?? orgId
}

function invalidateQueryGroups(queryClient: ReturnType<typeof useQueryClient>, keys: Array<readonly unknown[]>) {
  keys.forEach((queryKey) => {
    void queryClient.invalidateQueries({ queryKey: queryKey as any })
  })
}

export function useDeviceRealtime(explicitOrgId?: string | null) {
  const resolvedOrgId = useResolvedOrgId(explicitOrgId)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!resolvedOrgId) return

    const channel = supabase
      .channel(`devices:${resolvedOrgId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'whatsapp_devices',
        filter: `org_id=eq.${resolvedOrgId}`,
      }, (payload: any) => {
        const previousStatus = payload.old?.status
        const nextStatus = payload.new?.status
        const deviceName = payload.new?.name || payload.old?.name || 'Device'

        if (
          payload.eventType === 'UPDATE'
          && previousStatus
          && nextStatus
          && previousStatus !== nextStatus
        ) {
          if (nextStatus === 'connected') {
            toast.success(`${deviceName} connected`)
          } else if (nextStatus === 'disconnected') {
            toast.error(`${deviceName} disconnected`)
          }
        }

        invalidateQueryGroups(queryClient, [
          ['devices'],
          ['analytics', 'devices'],
          ['analytics', 'overview'],
          ['anti-ban', 'scores'],
          ['anti-ban', 'rules'],
        ])
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, resolvedOrgId])
}

export function useCampaignRealtime(campaignId?: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!campaignId) return

    const campaignChannel = supabase
      .channel(`campaign:${campaignId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'campaigns',
        filter: `id=eq.${campaignId}`,
      }, () => {
        invalidateQueryGroups(queryClient, [
          ['campaigns'],
          ['campaigns', campaignId],
          ['analytics', 'campaigns'],
          ['analytics', 'overview'],
        ])
      })
      .subscribe()

    const messageChannel = supabase
      .channel(`campaign-messages:${campaignId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `campaign_id=eq.${campaignId}`,
      }, () => {
        invalidateQueryGroups(queryClient, [
          ['campaigns'],
          ['campaigns', campaignId],
          ['campaign-messages', campaignId],
          ['analytics', 'campaigns'],
          ['analytics', 'funnel'],
          ['analytics', 'overview'],
          ['analytics', 'volume'],
        ])
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(campaignChannel)
      void supabase.removeChannel(messageChannel)
    }
  }, [campaignId, queryClient])
}

export function useInboxRealtime(explicitOrgId?: string | null) {
  const resolvedOrgId = useResolvedOrgId(explicitOrgId)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!resolvedOrgId) return

    const conversationChannel = supabase
      .channel(`conversations:${resolvedOrgId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `org_id=eq.${resolvedOrgId}`,
      }, () => {
        invalidateQueryGroups(queryClient, [
          ['conversations'],
          ['conversations', 'unread-count'],
        ])
      })
      .subscribe()

    const messageChannel = supabase
      .channel(`messages:${resolvedOrgId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `org_id=eq.${resolvedOrgId}`,
      }, () => {
        invalidateQueryGroups(queryClient, [
          ['conversations'],
          ['conversations', 'unread-count'],
          ['messages'],
          ['analytics', 'overview'],
        ])
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(conversationChannel)
      void supabase.removeChannel(messageChannel)
    }
  }, [queryClient, resolvedOrgId])
}

export function useDevicesRealtime(explicitOrgId?: string | null) {
  useDeviceRealtime(explicitOrgId)
}

export function useCampaignsRealtime(explicitOrgId?: string | null) {
  const resolvedOrgId = useResolvedOrgId(explicitOrgId)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!resolvedOrgId) return

    const channel = supabase
      .channel(`campaigns:${resolvedOrgId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'campaigns',
        filter: `org_id=eq.${resolvedOrgId}`,
      }, () => {
        invalidateQueryGroups(queryClient, [
          ['campaigns'],
          ['analytics', 'campaigns'],
          ['analytics', 'overview'],
        ])
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, resolvedOrgId])
}

export function useConversationRealtime(conversationId?: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        invalidateQueryGroups(queryClient, [
          ['messages', conversationId],
          ['conversations'],
          ['conversations', 'unread-count'],
        ])
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, queryClient])
}

export function useInboxUnreadRealtime(explicitOrgId?: string | null) {
  useInboxRealtime(explicitOrgId)
}
