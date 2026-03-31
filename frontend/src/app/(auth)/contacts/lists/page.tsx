'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

export default function ContactListsPage() {
  const { data: lists = [] } = useQuery({
    queryKey: ['contact-lists'],
    queryFn: async () => (await api.get('/contacts/lists')).data.data || [],
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Contact Lists</h2>
        <p className="text-muted-foreground">Create and manage reusable contact audiences here.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Saved Lists</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {lists.map((list: any) => (
            <div key={list.id} className="rounded-lg border p-3">
              <div className="font-medium">{list.name}</div>
              <div className="text-sm text-muted-foreground">
                {list.contact_count} contacts
              </div>
            </div>
          ))}
          {lists.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No contact lists have been created yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
