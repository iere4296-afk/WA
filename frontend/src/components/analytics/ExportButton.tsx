'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExportButtonProps {
  href: string
}

export function ExportButton({ href }: ExportButtonProps) {
  return (
    <Button variant="outline" asChild>
      <a href={href}>
        <Download className="mr-2 h-4 w-4" />
        Export
      </a>
    </Button>
  )
}
