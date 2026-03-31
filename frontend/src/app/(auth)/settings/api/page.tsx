'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export default function SettingsApiPage() {
  const { data: apiKeys = [], refetch } = useQuery({
    queryKey: ['settings', 'api-keys'],
    queryFn: async () => (await api.get('/settings/api-keys')).data.data || [],
  })
  const { data: webhooks = [] } = useQuery({
    queryKey: ['settings', 'webhooks'],
    queryFn: async () => (await api.get('/settings/webhooks')).data.data || [],
  })
  const createKey = useMutation({
    mutationFn: async () => (await api.post('/settings/api-keys', { name: 'Workspace API Key' })).data.data,
    onSuccess: () => {
      void refetch()
      toast.success('API key generated.')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Unable to generate API key.')
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">API Settings</h2>
        <p className="text-muted-foreground">Manage API keys and webhook credentials.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>API Keys</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {apiKeys.map((apiKey: any) => (
            <div key={apiKey.id} className="rounded-lg border p-3">
              <div className="font-medium">{apiKey.name || 'API Key'}</div>
              <div className="text-sm text-muted-foreground">{apiKey.masked}</div>
            </div>
          ))}
          <Button onClick={() => createKey.mutate()} disabled={createKey.isPending}>
            {createKey.isPending ? 'Generating...' : 'Generate API Key'}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Webhooks</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {webhooks.map((webhook: any) => (
            <div key={webhook.id} className="rounded-lg border p-3">
              <div className="font-medium">{webhook.url}</div>
              <div className="text-sm text-muted-foreground">{(webhook.events || []).join(', ')}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
