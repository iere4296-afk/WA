import type { ReactNode } from 'react'

export type StatusValue =
  | 'connected'
  | 'disconnected'
  | 'qr_pending'
  | 'error'
  | 'warmup'
  | 'connecting'
  | 'paused'
  | 'banned'
  | 'draft'
  | 'running'
  | 'completed'
  | 'failed'
  | 'scheduled'
  | 'active'
  | 'inactive'
  | 'open'
  | 'resolved'
  | 'pending'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface SidebarItem {
  id: string
  label: string
  href: string
  icon: ReactNode
  badge?: number | string
  active?: boolean
  disabled?: boolean
}

export interface SidebarSection {
  label: string
  items: SidebarItem[]
}

export interface AppShellProps {
  children: ReactNode
  defaultCollapsed?: boolean
}

export interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
  unreadCount?: number
  sections?: SidebarSection[]
}

export interface TopBarProps {
  breadcrumbs?: BreadcrumbItem[]
  title?: string
  subtitle?: string
  showSetupBanner?: boolean
}

export interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  destructive?: boolean
  loading?: boolean
  confirmText?: string
  cancelText?: string
}

export interface StatusBadgeProps {
  status: StatusValue
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export interface StatCardProps {
  title: string
  value: string | number
  change?: number
  icon?: ReactNode
  loading?: boolean
  trend?: 'up' | 'down' | 'neutral'
}

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export interface SkeletonPageProps {
  rows?: number
  showHeader?: boolean
  showSidebar?: boolean
}

export interface SetupBannerProps {
  dismissible?: boolean
  onDismiss?: () => void
}

export interface DataTableColumn<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  width?: string
  className?: string
  render?: (row: T) => ReactNode
}

export interface DataTablePagination {
  nextCursor: string | null
  previousCursor?: string | null
  hasMore: boolean
}

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>
  data: T[]
  loading?: boolean
  emptyState?: ReactNode
  searchValue?: string
  searchPlaceholder?: string
  onSearchChange?: (value: string) => void
  onRowClick?: (row: T) => void
  pagination?: DataTablePagination
  onNextPage?: () => void
  onPreviousPage?: () => void
}

export interface DialogState<T = Record<string, unknown>> {
  open: boolean
  payload?: T
}

export interface BaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  loading?: boolean
  children?: ReactNode
}

export interface SelectOption {
  label: string
  value: string
  icon?: ReactNode
  description?: string
}

export interface FormFieldProps {
  name: string
  label?: string
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'tel'
  required?: boolean
  disabled?: boolean
  error?: string
  value?: string | number
  onChange?: (value: string | number) => void
}

export interface SelectFieldProps extends Omit<FormFieldProps, 'onChange' | 'value' | 'type'> {
  value?: string
  options: SelectOption[]
  onChange?: (value: string) => void
}

export interface PaginationProps {
  hasMore: boolean
  loading?: boolean
  onNext: () => void
  onPrev?: () => void
}

export interface DeviceCardProps {
  id: string
  name: string
  phone?: string
  status: StatusValue
  healthScore?: number
  onClick?: () => void
}

export interface QRCodePanelProps {
  deviceId: string
  qrCode?: string | null
  status?: StatusValue
  onRefresh?: () => void
}

export interface CampaignProgressBarProps {
  sent: number
  delivered: number
  read: number
  failed: number
  total: number
}

export interface MessageBubbleProps {
  text: string
  sender: 'user' | 'contact'
  timestamp?: Date
  status?: 'pending' | 'sent' | 'delivered' | 'read'
}

export interface ChartProps<T = Record<string, unknown>> {
  data: T[]
  loading?: boolean
  height?: number
}
