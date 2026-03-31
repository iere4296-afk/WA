'use client'

import { ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface EditRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

export function EditRuleDialog({ open, onOpenChange, children }: EditRuleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Auto-Reply Rule</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
