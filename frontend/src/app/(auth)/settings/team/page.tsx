'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

export default function SettingsTeamPage() {
  const { data: members = [] } = useQuery({
    queryKey: ['settings', 'team'],
    queryFn: async () => (await api.get('/settings/team')).data.data || [],
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Team Settings</h2>
        <p className="text-muted-foreground">Invite teammates, change roles, and manage access.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Members</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {members.map((member: any) => (
            <div key={member.id || member.user_id} className="rounded-lg border p-3">
              <div className="font-medium">{member.email || 'Pending invite'}</div>
              <div className="text-sm text-muted-foreground capitalize">{member.role}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
