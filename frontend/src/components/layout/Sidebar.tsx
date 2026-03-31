'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bot,
  FileText,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Reply,
  Settings,
  Shield,
  Smartphone,
  Users,
  Workflow,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInboxUnreadCount } from '@/hooks/useInbox'
import { useInboxUnreadRealtime } from '@/hooks/useRealtime'

interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  isMobile: boolean
  onClose: () => void
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navigationSections = (unreadCount: number): NavSection[] => [
  {
    label: 'OPERATIONS',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Devices', href: '/devices', icon: Smartphone },
      { label: 'Contacts', href: '/contacts', icon: Users },
      { label: 'Campaigns', href: '/campaigns', icon: Megaphone },
      { label: 'Inbox', href: '/inbox', icon: MessageSquare, badge: unreadCount },
    ],
  },
  {
    label: 'AUTOMATION',
    items: [
      { label: 'Templates', href: '/templates', icon: FileText },
      { label: 'Auto-Reply', href: '/auto-reply', icon: Reply },
      { label: 'Flows', href: '/flows', icon: Workflow },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { label: 'Analytics', href: '/analytics', icon: BarChart3 },
      { label: 'Anti-Ban', href: '/anti-ban', icon: Shield },
      { label: 'AI Studio', href: '/ai-studio', icon: Bot },
    ],
  },
]

const LOGO_URL = 'https://www.investmentexperts.ae/logo.png'

function isItemActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar({ collapsed, mobileOpen, isMobile, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: unreadCount = 0 } = useInboxUnreadCount()

  useInboxUnreadRealtime()

  const isVisible = isMobile ? mobileOpen : true
  const sections = navigationSections(unreadCount)

  return (
    <>
      {isMobile && mobileOpen ? (
        <button
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-slate-950/50"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-[#0F172A] text-slate-100 shadow-xl transition-all duration-300',
          isMobile ? 'w-72' : collapsed ? 'w-20' : 'w-72',
          isVisible ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-24 items-center justify-between border-b border-white/10 px-5">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3" onClick={isMobile ? onClose : undefined}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/18 ring-1 ring-emerald-400/28 shadow-[0_0_0_1px_rgba(52,211,153,0.10),0_0_18px_rgba(52,211,153,0.18),0_0_34px_rgba(234,179,8,0.08)]">
              <img
                src={LOGO_URL}
                alt="Investment Experts logo"
                className="h-9 w-9 object-contain drop-shadow-[0_0_14px_rgba(52,211,153,0.30)]"
              />
            </div>
            {!collapsed || isMobile ? (
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold tracking-[0.02em] text-white drop-shadow-[0_0_14px_rgba(52,211,153,0.16)]">
                  WA Intelligence
                </p>
                <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/85 drop-shadow-[0_0_10px_rgba(52,211,153,0.12)]">
                  By IERE
                </p>
              </div>
            ) : null}
          </Link>

          {isMobile ? (
            <button
              aria-label="Close navigation"
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-3 py-5">
          <div className="space-y-6">
            {sections.map((section) => (
              <div key={section.label} className="space-y-2">
                {!collapsed || isMobile ? (
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {section.label}
                  </p>
                ) : null}

                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const active = isItemActive(pathname, item.href)

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={isMobile ? onClose : undefined}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-2xl border-l-4 px-3 py-3 text-sm transition',
                          collapsed && !isMobile ? 'justify-center px-2' : '',
                          active
                            ? 'border-[#22C55E] bg-emerald-500/12 text-white'
                            : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white',
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {!collapsed || isMobile ? <span className="truncate">{item.label}</span> : null}

                        {item.badge ? (
                          <span
                            className={cn(
                              'ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[11px] font-semibold text-slate-950',
                              collapsed && !isMobile ? 'absolute right-1 top-1 min-w-4 px-1 py-0 text-[10px]' : '',
                            )}
                          >
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        ) : null}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto border-t border-white/10 pt-5">
            {!collapsed || isMobile ? (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                SETTINGS
              </p>
            ) : null}

            <Link
              href="/settings"
              onClick={isMobile ? onClose : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-2xl border-l-4 px-3 py-3 text-sm transition',
                collapsed && !isMobile ? 'justify-center px-2' : '',
                isItemActive(pathname, '/settings')
                  ? 'border-[#22C55E] bg-emerald-500/12 text-white'
                  : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white',
              )}
            >
              <Settings className="h-5 w-5 shrink-0" />
              {!collapsed || isMobile ? <span>Settings</span> : null}
            </Link>
          </div>
        </div>
      </aside>
    </>
  )
}
