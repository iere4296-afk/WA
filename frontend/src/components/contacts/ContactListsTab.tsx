'use client'

import { useEffect, useState } from 'react'
import { ListPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { useContactLists, useContacts, useCreateContactList } from '@/hooks/useContacts'
import { formatDate, formatPhone } from '@/lib/utils'

export function ContactListsTab() {
  const listsQuery = useContactLists()
  const createList = useCreateContactList()
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const membersQuery = useContacts({
    listId: selectedListId || undefined,
    limit: 25,
    cursor,
  })

  useEffect(() => {
    if (!selectedListId && listsQuery.data?.length) {
      setSelectedListId(listsQuery.data[0].id)
    }
  }, [listsQuery.data, selectedListId])

  useEffect(() => {
    setCursor(undefined)
    setCursorHistory([])
  }, [selectedListId])

  async function handleCreateList() {
    try {
      const list = await createList.mutateAsync({
        name,
        description,
        type: 'static',
      })
      setCreateOpen(false)
      setName('')
      setDescription('')
      setSelectedListId(list.id)
      toast.success('Contact list created.')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to create contact list.')
    }
  }

  const selectedList = listsQuery.data?.find((list) => list.id === selectedListId) || null
  const memberPagination = membersQuery.data?.meta

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Contact Lists</CardTitle>
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <ListPlus className="h-4 w-4" />
            Create List
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {!listsQuery.data?.length ? (
            <EmptyState
              icon={Users}
              title="No contact lists yet"
              description="Create a list to organize contacts into reusable audiences."
              action={{ label: 'Create List', onClick: () => setCreateOpen(true) }}
            />
          ) : (
            listsQuery.data.map((list) => (
              <button
                key={list.id}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  selectedListId === list.id
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
                onClick={() => setSelectedListId(list.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-950">{list.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{list.description || 'No description'}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {list.contact_count} members
                  </span>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>{selectedList?.name || 'List Members'}</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedListId ? (
            <DataTable
              data={membersQuery.data?.data || []}
              loading={membersQuery.isLoading}
              searchable={false}
              getRowKey={(contact) => contact.id}
              columns={[
                { key: 'name', header: 'Name', cell: (contact) => contact.name || 'Unnamed' },
                { key: 'phone', header: 'Phone', cell: (contact) => formatPhone(contact.phone) },
                { key: 'status', header: 'Status', cell: (contact) => contact.status },
                { key: 'created_at', header: 'Created', cell: (contact) => formatDate(contact.created_at) },
              ]}
              emptyState="This list has no members yet."
              pagination={{
                nextCursor: memberPagination?.nextCursor,
                previousCursor: cursorHistory.length > 0 ? 'previous' : null,
                hasMore: memberPagination?.hasMore,
              }}
              onNextPage={() => {
                if (!memberPagination?.nextCursor) return
                setCursorHistory((current) => [...current, cursor])
                setCursor(memberPagination.nextCursor || undefined)
              }}
              onPreviousPage={() => {
                if (cursorHistory.length === 0) return
                const previousCursor = cursorHistory[cursorHistory.length - 1]
                setCursorHistory((current) => current.slice(0, -1))
                setCursor(previousCursor)
              }}
            />
          ) : (
            <EmptyState
              icon={Users}
              title="Select a list"
              description="Choose a contact list to inspect its members."
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Contact List</DialogTitle>
            <DialogDescription>
              Lists can be reused as campaign audiences and contact filters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">List name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="VIP Customers" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="High-intent contacts for repeat purchase campaigns"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => void handleCreateList()}
              disabled={!name.trim() || createList.isPending}
            >
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
