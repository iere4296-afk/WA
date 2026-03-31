'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { Contact } from '@/types'
import { formatDate, formatPhone } from '@/lib/utils'

interface ContactTableProps {
  contacts: Contact[]
  loading?: boolean
  selectedIds: string[]
  onSelectionChange: (selectedIds: string[]) => void
  onBulkDelete: () => void
  onRowClick: (contact: Contact) => void
  bulkDeleting?: boolean
  pagination?: {
    nextCursor?: string | null
    previousCursor?: string | null
    hasMore?: boolean
  }
  onNextPage?: () => void
  onPreviousPage?: () => void
}

function renderWaIndicator(contact: Contact) {
  const state = (contact.wa_status || 'unknown').toLowerCase()
  const tone = state === 'valid' || state === 'active'
    ? 'bg-emerald-500'
    : state === 'invalid'
      ? 'bg-rose-500'
      : 'bg-slate-400'

  const label = state === 'valid' || state === 'active'
    ? 'WA Valid'
    : state === 'invalid'
      ? 'WA Invalid'
      : 'Unchecked'

  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
      <span>{label}</span>
    </div>
  )
}

export function ContactTable({
  contacts,
  loading = false,
  selectedIds,
  onSelectionChange,
  onBulkDelete,
  onRowClick,
  bulkDeleting = false,
  pagination,
  onNextPage,
  onPreviousPage,
}: ContactTableProps) {
  const allSelected = contacts.length > 0 && contacts.every((contact) => selectedIds.includes(contact.id))

  function toggleRow(contactId: string) {
    if (selectedIds.includes(contactId)) {
      onSelectionChange(selectedIds.filter((id) => id !== contactId))
      return
    }

    onSelectionChange([...selectedIds, contactId])
  }

  function toggleAll() {
    if (allSelected) {
      onSelectionChange([])
      return
    }

    onSelectionChange(contacts.map((contact) => contact.id))
  }

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 ? (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-medium text-emerald-900">
            {selectedIds.length} contact{selectedIds.length === 1 ? '' : 's'} selected
          </p>
          <Button variant="destructive" onClick={onBulkDelete} disabled={bulkDeleting}>
            <Trash2 className="h-4 w-4" />
            {bulkDeleting ? 'Deleting...' : 'Bulk Delete'}
          </Button>
        </div>
      ) : null}

      <DataTable
        data={contacts}
        loading={loading}
        searchable={false}
        getRowKey={(contact) => contact.id}
        onRowClick={onRowClick}
        emptyState="No contacts found."
        pagination={pagination}
        onNextPage={onNextPage}
        onPreviousPage={onPreviousPage}
        columns={[
          {
            key: 'select',
            header: (
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                onClick={(event) => event.stopPropagation()}
                aria-label="Select all contacts"
              />
            ),
            className: 'w-12',
            cell: (contact) => (
              <div onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(contact.id)}
                  onChange={() => toggleRow(contact.id)}
                  aria-label={`Select ${contact.name || contact.phone}`}
                />
              </div>
            ),
          },
          {
            key: 'name',
            header: 'Name',
            sortable: true,
            searchValue: (contact) => `${contact.name || ''} ${contact.phone}`,
            cell: (contact) => (
              <div>
                <p className="font-medium text-slate-950">{contact.name || 'Unnamed'}</p>
                <p className="text-xs text-slate-500">{contact.email || 'No email'}</p>
              </div>
            ),
          },
          {
            key: 'phone',
            header: 'Phone',
            sortable: true,
            cell: (contact) => formatPhone(contact.phone),
          },
          {
            key: 'wa_status',
            header: 'Status',
            cell: (contact) => renderWaIndicator(contact),
          },
          {
            key: 'tags',
            header: 'Tags',
            cell: (contact) => (
              <div className="flex flex-wrap gap-1">
                {contact.tags?.length ? contact.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                )) : <span className="text-sm text-slate-400">No tags</span>}
              </div>
            ),
          },
          {
            key: 'created_at',
            header: 'Created',
            sortable: true,
            cell: (contact) => formatDate(contact.created_at),
          },
        ]}
      />
    </div>
  )
}
