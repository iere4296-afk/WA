'use client'

import { useEffect, useState } from 'react'
import { Plus, Upload, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonPage } from '@/components/shared/SkeletonPage'
import { AddContactDialog } from '@/components/contacts/AddContactDialog'
import { ContactDetailSheet } from '@/components/contacts/ContactDetailSheet'
import { ContactListsTab } from '@/components/contacts/ContactListsTab'
import { ContactTable } from '@/components/contacts/ContactTable'
import { ImportCSVDialog } from '@/components/contacts/ImportCSVDialog'
import {
  useBulkDeleteContacts,
  useContacts,
  useCreateContact,
} from '@/hooks/useContacts'

const DEFAULT_FORM = {
  name: '',
  phone: '',
  email: '',
  tags: '',
}

export default function ContactsPage() {
  const [activeTab, setActiveTab] = useState('contacts')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tagsFilter, setTagsFilter] = useState('')
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [contactForm, setContactForm] = useState(DEFAULT_FORM)
  const [selectedContact, setSelectedContact] = useState<any | null>(null)
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false)

  const contactsQuery = useContacts({
    cursor,
    limit: 25,
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    tags: tagsFilter
      ? tagsFilter.split(',').map((tag) => tag.trim()).filter(Boolean)
      : undefined,
  })
  const createContact = useCreateContact()
  const bulkDeleteContacts = useBulkDeleteContacts()

  useEffect(() => {
    setCursor(undefined)
    setCursorHistory([])
    setSelectedIds([])
  }, [search, statusFilter, tagsFilter, activeTab])

  async function handleCreateContact() {
    try {
      await createContact.mutateAsync({
        name: contactForm.name || undefined,
        phone: contactForm.phone,
        email: contactForm.email || undefined,
        tags: contactForm.tags
          ? contactForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : [],
      })
      toast.success('Contact created.')
      setAddDialogOpen(false)
      setContactForm(DEFAULT_FORM)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to create contact.')
    }
  }

  async function handleBulkDelete() {
    try {
      const result = await bulkDeleteContacts.mutateAsync(selectedIds)
      toast.success(`Deleted ${result.deleted} contacts.`)
      setSelectedIds([])
      setConfirmBulkDeleteOpen(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to delete selected contacts.')
    }
  }

  const contacts = contactsQuery.data?.data || []
  const pagination = contactsQuery.data?.meta

  if (contactsQuery.isLoading && !contactsQuery.data && activeTab === 'contacts') {
    return <SkeletonPage rows={5} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Contacts</h2>
          <p className="text-sm text-slate-500">
            Search, import, segment, and reuse contacts across campaigns and inbox workflows.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-2xl bg-slate-100">
          <TabsTrigger value="contacts" className="rounded-xl">All Contacts</TabsTrigger>
          <TabsTrigger value="lists" className="rounded-xl">Lists</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-4 pt-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.5fr_0.7fr]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search contacts by name, phone, or email"
            />
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="opted_out">Opted Out</option>
              <option value="invalid">Invalid</option>
              <option value="blocked">Blocked</option>
            </select>
            <Input
              value={tagsFilter}
              onChange={(event) => setTagsFilter(event.target.value)}
              placeholder="Filter by tags: vip, retail"
            />
          </div>

          {contacts.length === 0 && !contactsQuery.isLoading ? (
            <EmptyState
              icon={Users}
              title="No contacts found"
              description="Add a contact manually or import a CSV/XLSX file to populate your workspace."
              action={{ label: 'Import Contacts', onClick: () => setImportDialogOpen(true) }}
            />
          ) : (
            <ContactTable
              contacts={contacts}
              loading={contactsQuery.isLoading}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onBulkDelete={() => setConfirmBulkDeleteOpen(true)}
              onRowClick={(contact) => setSelectedContact(contact)}
              bulkDeleting={bulkDeleteContacts.isPending}
              pagination={{
                nextCursor: pagination?.nextCursor,
                previousCursor: cursorHistory.length > 0 ? 'previous' : null,
                hasMore: pagination?.hasMore,
              }}
              onNextPage={() => {
                if (!pagination?.nextCursor) return
                setCursorHistory((current) => [...current, cursor])
                setCursor(pagination.nextCursor || undefined)
              }}
              onPreviousPage={() => {
                if (cursorHistory.length === 0) return
                const previousCursor = cursorHistory[cursorHistory.length - 1]
                setCursorHistory((current) => current.slice(0, -1))
                setCursor(previousCursor)
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="lists" className="pt-4">
          <ContactListsTab />
        </TabsContent>
      </Tabs>

      <AddContactDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        values={contactForm}
        onChange={setContactForm}
        onSubmit={() => void handleCreateContact()}
        loading={createContact.isPending}
      />

      <ImportCSVDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      <ContactDetailSheet
        open={!!selectedContact}
        onOpenChange={(open) => {
          if (!open) setSelectedContact(null)
        }}
        contact={selectedContact}
      />

      <ConfirmDialog
        open={confirmBulkDeleteOpen}
        onOpenChange={setConfirmBulkDeleteOpen}
        title="Delete selected contacts?"
        description="This will soft-delete the selected contacts from the workspace."
        destructive
        confirmText={bulkDeleteContacts.isPending ? 'Deleting...' : 'Delete Contacts'}
        onConfirm={handleBulkDelete}
      />
    </div>
  )
}
