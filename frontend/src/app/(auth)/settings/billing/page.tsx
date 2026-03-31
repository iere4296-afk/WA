'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export default function SettingsBillingPage() {
  const { data } = useQuery({
    queryKey: ['billing', 'usage'],
    queryFn: async () => (await api.get('/billing/usage')).data.data,
  })
  const portal = useMutation({
    mutationFn: async () => (await api.post('/billing/portal')).data.data,
    onSuccess: (payload) => {
      if (payload?.url) window.location.href = payload.url
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Unable to open billing portal.')
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Billing Settings</h2>
        <p className="text-muted-foreground">Track plan limits and subscription actions.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Current Usage</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p>Messages Sent: {data?.usage?.messages_sent || 0}</p>
          <p>AI Calls: {data?.usage?.ai_calls || 0}</p>
          <p>Plan: {data?.org?.plan || 'free'}</p>
          <Button onClick={() => portal.mutate()} disabled={portal.isPending}>
            {portal.isPending ? 'Opening...' : 'Manage Subscription'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
