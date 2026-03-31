import { createElement, ElementType, isValidElement, ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: ElementType | ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  actionLabel?: string
  onAction?: () => void
}

function renderIcon(icon: EmptyStateProps['icon']) {
  if (isValidElement(icon)) {
    return icon
  }

  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
    return createElement(icon as ElementType, {
      className: 'h-8 w-8 text-muted-foreground',
    })
  }

  return null
}

export function EmptyState({ icon, title, description, action, actionLabel, onAction }: EmptyStateProps) {
  const resolvedAction = action ?? (actionLabel && onAction ? { label: actionLabel, onClick: onAction } : null)

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        {renderIcon(icon)}
      </div>
      <h3 className="mb-1 text-lg font-semibold">{title}</h3>
      <p className="mb-4 max-w-xs text-sm text-muted-foreground">{description}</p>
      {resolvedAction ? (
        <Button onClick={resolvedAction.onClick} className="bg-green-600 hover:bg-green-700">
          {resolvedAction.label}
        </Button>
      ) : null}
    </div>
  )
}
