'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, CreditCard, KeyRound, Trash2, Upload, UserPlus, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useOrg } from '@/hooks/useOrg'
import { api } from '@/lib/api'
import { formatDate, getInitials } from '@/lib/utils'
import type {
  ApiKeysResponse,
  BillingUsageResponse,
  TeamMembersResponse,
  WebhooksResponse,
} from '@/types/api.types'
import { toast } from 'sonner'

type TeamMember = TeamMembersResponse['data'][number]
type ApiKeyItem = ApiKeysResponse['data'][number]
type WebhookItem = WebhooksResponse['data'][number]

const ROLE_OPTIONS = ['owner', 'admin', 'operator', 'member', 'viewer'] as const

function UsageBar({
  label,
  value,
  limit,
}: {
  label: string
  value: number
  limit: number
}) {
  const percent = limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : 0

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-sm text-slate-500">
          {value.toLocaleString()} / {limit.toLocaleString()}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { user, checkAuth } = useAuth()
  const { org, plan, usage, limits } = useOrg()
  const [activeTab, setActiveTab] = useState('general')
  const [logoPreview, setLogoPreview] = useState('')
  const [orgForm, setOrgForm] = useState({
    name: '',
    timezone: 'UTC',
    logoUrl: '',
  })
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'member' as TeamMember['role'],
  })
  const [apiKeyName, setApiKeyName] = useState('Workspace API Key')
  const [apiKeySecrets, setApiKeySecrets] = useState<Record<string, string>>({})
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
  const [apiKeyToRevoke, setApiKeyToRevoke] = useState<ApiKeyItem | null>(null)

  useEffect(() => {
    setOrgForm({
      name: org?.name || '',
      timezone: org?.timezone || 'UTC',
      logoUrl: org?.logo_url || '',
    })
    setLogoPreview(org?.logo_url || '')
  }, [org])

  const teamQuery = useQuery({
    queryKey: ['settings', 'team'],
    queryFn: async () => {
      const { data } = await api.get<TeamMembersResponse>('/settings/team')
      return data.data || []
    },
  })

  const apiKeysQuery = useQuery({
    queryKey: ['settings', 'api-keys'],
    queryFn: async () => {
      const { data } = await api.get<ApiKeysResponse>('/settings/api-keys')
      return data.data || []
    },
  })

  const webhooksQuery = useQuery({
    queryKey: ['settings', 'webhooks'],
    queryFn: async () => {
      const { data } = await api.get<WebhooksResponse>('/settings/webhooks')
      return data.data || []
    },
  })

  const billingQuery = useQuery({
    queryKey: ['billing', 'usage'],
    queryFn: async () => {
      const { data } = await api.get<BillingUsageResponse>('/billing/usage')
      return data.data
    },
  })

  const canInvite = user?.role === 'owner' || user?.role === 'admin'
  const canManageRoles = user?.role === 'owner'
  const canManageApi = user?.role === 'owner' || user?.role === 'admin'

  const updateOrg = useMutation({
    mutationFn: async () => {
      await api.patch('/settings/org', {
        name: orgForm.name,
        timezone: orgForm.timezone,
        logoUrl: orgForm.logoUrl || undefined,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['org'] }),
        queryClient.invalidateQueries({ queryKey: ['settings'] }),
      ])
      await checkAuth()
      toast.success('Organization settings updated')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Unable to update organization settings')
    },
  })

  const inviteMember = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/settings/team/invite', inviteForm)
      return data.data
    },
    onSuccess: async () => {
      setInviteForm({ email: '', role: 'member' })
      await queryClient.invalidateQueries({ queryKey: ['settings', 'team'] })
      toast.success('Invite created')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Unable to invite this team member')
    },
  })

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: TeamMember['role'] }) => {
      await api.patch(`/settings/team/${userId}/role`, { role })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', 'team'] })
      toast.success('Member role updated')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Unable to update the selected role')
    },
  })

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/settings/team/${userId}`)
    },
    onSuccess: async () => {
      setMemberToRemove(null)
      await queryClient.invalidateQueries({ queryKey: ['settings', 'team'] })
      toast.success('Team member removed')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Unable to remove this member')
    },
  })

  const openBillingPortal = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/billing/portal')
      return data.data as { url?: string }
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Unable to open the Stripe billing portal')
    },
  })

  const createApiKey = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/settings/api-keys', { name: apiKeyName })
      return data.data as ApiKeyItem & { value: string }
    },
    onSuccess: async (data) => {
      setApiKeySecrets((current) => ({ ...current, [data.id]: data.value }))
      await queryClient.invalidateQueries({ queryKey: ['settings', 'api-keys'] })
      toast.success('API key generated. Copy it now because this is the only time the raw value is shown.')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Unable to generate a new API key')
    },
  })

  const revokeApiKey = useMutation({
    mutationFn: async (keyId: string) => {
      await api.delete(`/settings/api-keys/${keyId}`)
    },
    onSuccess: async () => {
      setApiKeyToRevoke(null)
      await queryClient.invalidateQueries({ queryKey: ['settings', 'api-keys'] })
      toast.success('API key revoked')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Unable to revoke this API key')
    },
  })

  const teamMembers = teamQuery.data || []
  const apiKeys = apiKeysQuery.data || []
  const webhooks = webhooksQuery.data || []
  const billingUsage = billingQuery.data

  const currentPlanName = billingUsage?.limits?.name || plan || org?.plan || 'free'
  const messageUsage = billingUsage?.usage?.messages_sent ?? usage.messages_sent
  const aiUsage = billingUsage?.usage?.ai_calls ?? usage.ai_calls
  const contactsUsage = billingUsage?.usage?.contacts_stored ?? usage.contacts_stored
  const messageLimit = billingUsage?.limits?.monthlyMessages ?? limits.monthlyMessages
  const aiLimit = billingUsage?.limits?.aiCalls ?? limits.aiCalls
  const contactsLimit = billingUsage?.limits?.contacts ?? limits.contacts

  const sortedApiKeys = useMemo(
    () => [...apiKeys].sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || ''))),
    [apiKeys],
  )

  function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const nextValue = typeof reader.result === 'string' ? reader.result : ''
      setLogoPreview(nextValue)
      setOrgForm((current) => ({ ...current, logoUrl: nextValue }))
    }
    reader.readAsDataURL(file)
  }

  async function copyValue(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(successMessage)
    } catch {
      toast.error('Clipboard access failed')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-950">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage organization details, team access, billing usage, API keys, and webhook endpoints from one place.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>General</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[0.8fr,0.2fr]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization name</Label>
                  <Input
                    id="org-name"
                    value={orgForm.name}
                    onChange={(event) => setOrgForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-timezone">Timezone</Label>
                  <select
                    id="org-timezone"
                    value={orgForm.timezone}
                    onChange={(event) => setOrgForm((current) => ({ ...current, timezone: event.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    <option value="UTC">UTC</option>
                    <option value="Asia/Dubai">Asia/Dubai</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Chicago">America/Chicago</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="Europe/London">Europe/London</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-logo">Logo upload</Label>
                  <Input id="org-logo" type="file" accept="image/*" onChange={handleLogoUpload} />
                  <p className="text-xs text-slate-500">
                    The selected image is stored as the organization logo URL in settings.
                  </p>
                </div>

                <Button onClick={() => updateOrg.mutate()} disabled={updateOrg.isPending}>
                  {updateOrg.isPending ? 'Saving...' : 'Save general settings'}
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Logo preview</p>
                <div className="mt-4 flex h-36 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Organization logo preview" className="max-h-28 max-w-full object-contain" />
                  ) : (
                    <div className="text-center text-sm text-slate-500">
                      <Upload className="mx-auto mb-2 h-5 w-5" />
                      Upload a logo to preview it here
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Invite by email</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1fr,180px,auto]">
              <Input
                value={inviteForm.email}
                onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="teammate@company.com"
              />
              <select
                value={inviteForm.role}
                onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value as TeamMember['role'] }))}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <Button onClick={() => inviteMember.mutate()} disabled={!canInvite || inviteMember.isPending}>
                <UserPlus className="h-4 w-4" />
                Invite
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Team members</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {teamMembers.length > 0 ? (
                teamMembers.map((member) => (
                  <div key={member.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                        {getInitials(member.name || member.email || 'User')}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-950">{member.name || member.email || 'Pending invite'}</p>
                          {member.pending ? <Badge className="bg-amber-100 text-amber-700">Pending</Badge> : null}
                        </div>
                        <p className="text-sm text-slate-500">
                          {member.email || 'Awaiting acceptance'}
                          {member.joined_at ? ` • Joined ${formatDate(member.joined_at)}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <select
                        value={member.role}
                        disabled={!canManageRoles || !member.user_id || updateRole.isPending}
                        onChange={(event) => {
                          if (!member.user_id) return
                          updateRole.mutate({
                            userId: member.user_id,
                            role: event.target.value as TeamMember['role'],
                          })
                        }}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>

                      <Button
                        variant="outline"
                        className="text-rose-600 hover:text-rose-700"
                        disabled={!canManageRoles || !member.user_id}
                        onClick={() => setMemberToRemove(member)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  <Users className="mx-auto mb-2 h-5 w-5" />
                  No team members found for this organization yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Billing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-semibold text-slate-950">{currentPlanName}</p>
                    <Badge className="bg-emerald-100 text-emerald-700">{String(org?.plan || plan || 'free').toUpperCase()}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Live usage is read from the billing tables and your current org plan limits.
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={() => openBillingPortal.mutate()}
                  disabled={!canManageApi || openBillingPortal.isPending}
                >
                  <CreditCard className="h-4 w-4" />
                  {openBillingPortal.isPending ? 'Opening...' : 'Stripe portal'}
                </Button>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <UsageBar label="Messages" value={messageUsage} limit={messageLimit || 0} />
                <UsageBar label="AI calls" value={aiUsage} limit={aiLimit || 0} />
                <UsageBar label="Contacts" value={contactsUsage} limit={contactsLimit || 0} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>API keys</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                <Input value={apiKeyName} onChange={(event) => setApiKeyName(event.target.value)} />
                <Button onClick={() => createApiKey.mutate()} disabled={!canManageApi || createApiKey.isPending}>
                  <KeyRound className="h-4 w-4" />
                  Generate key
                </Button>
              </div>

              {sortedApiKeys.length > 0 ? (
                sortedApiKeys.map((key) => {
                  const rawValue = apiKeySecrets[key.id] || key.value
                  const copyValueForKey = rawValue || key.masked

                  return (
                    <div key={key.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-medium text-slate-950">{key.name}</p>
                        <p className="font-mono text-sm text-slate-500">{rawValue || key.masked}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {rawValue
                            ? 'Full key available in this session only. Copy it before leaving this page.'
                            : 'Stored keys are masked after creation for safety.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => void copyValue(copyValueForKey, rawValue ? 'API key copied' : 'Masked key copied')}
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          className="text-rose-600 hover:text-rose-700"
                          disabled={!canManageApi}
                          onClick={() => setApiKeyToRevoke(key)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Revoke
                        </Button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  No API keys have been created yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Webhook endpoints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {webhooks.length > 0 ? (
                webhooks.map((webhook) => (
                  <div key={webhook.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-950">{webhook.url}</p>
                      <Badge className={webhook.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                        {webhook.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{(webhook.events || []).join(', ')}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  No webhook endpoints configured for this organization yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!memberToRemove}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null)
        }}
        title="Remove team member?"
        description={`This will remove ${memberToRemove?.email || memberToRemove?.name || 'this member'} from the organization.`}
        destructive
        onConfirm={async () => {
          if (!memberToRemove?.user_id) return
          await removeMember.mutateAsync(memberToRemove.user_id)
        }}
      />

      <ConfirmDialog
        open={!!apiKeyToRevoke}
        onOpenChange={(open) => {
          if (!open) setApiKeyToRevoke(null)
        }}
        title="Revoke API key?"
        description={`This will permanently revoke ${apiKeyToRevoke?.name || 'this API key'}. Existing integrations using it will stop working.`}
        destructive
        onConfirm={async () => {
          if (!apiKeyToRevoke?.id) return
          await revokeApiKey.mutateAsync(apiKeyToRevoke.id)
        }}
      />
    </div>
  )
}
