'use client'

import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Contact } from '@/types'
import { formatDate, formatPhone } from '@/lib/utils'

interface ContactDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact | null
}

export function ContactDetailSheet({ open, onOpenChange, contact }: ContactDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{contact?.name || 'Contact detail'}</SheetTitle>
          <SheetDescription>
            {contact ? `${formatPhone(contact.phone)} - Created ${formatDate(contact.created_at)}` : 'Loading contact detail...'}
          </SheetDescription>
        </SheetHeader>

        {contact ? (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Phone</p>
                <p className="mt-2 font-medium text-slate-950">{formatPhone(contact.phone)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Email</p>
                <p className="mt-2 font-medium text-slate-950">{contact.email || 'No email'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</p>
                <div className="mt-2">
                  <StatusBadge status={contact.status} />
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">WhatsApp Check</p>
                <p className="mt-2 font-medium text-slate-950">{contact.wa_status || 'Unchecked'}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {contact.tags?.length ? contact.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                )) : <span className="text-sm text-slate-500">No tags assigned</span>}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Notes</p>
              <p className="mt-2 text-sm text-slate-700">{contact.notes || 'No notes for this contact.'}</p>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
