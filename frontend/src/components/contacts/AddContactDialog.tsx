'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface AddContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  values: {
    name: string
    phone: string
    email: string
    tags: string
  }
  onChange: (values: { name: string; phone: string; email: string; tags: string }) => void
  onSubmit: () => void
  loading?: boolean
}

export function AddContactDialog({ open, onOpenChange, values, onChange, onSubmit, loading = false }: AddContactDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>
            Create a single contact manually and keep it scoped to the current workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <Input
              value={values.name}
              onChange={(event) => onChange({ ...values, name: event.target.value })}
              placeholder="John Doe"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Phone</span>
            <Input
              value={values.phone}
              onChange={(event) => onChange({ ...values, phone: event.target.value })}
              placeholder="+15551234567"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <Input
              value={values.email}
              onChange={(event) => onChange({ ...values, email: event.target.value })}
              placeholder="john@example.com"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Tags</span>
            <Input
              value={values.tags}
              onChange={(event) => onChange({ ...values, tags: event.target.value })}
              placeholder="vip, retail, repeat"
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={onSubmit}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
