'use client'

import { useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronRight, LogOut, Menu, UserCircle2 } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SetupBanner } from '@/components/shared/SetupBanner'
import { useAuth } from '@/contexts/AuthContext'
import { getInitials } from '@/lib/utils'

interface TopBarProps {
  onMenuToggle: () => void
  showMenuButton: boolean
}

const breadcrumbLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  devices: 'Devices',
  contacts: 'Contacts',
  campaigns: 'Campaigns',
  inbox: 'Inbox',
  templates: 'Templates',
  'auto-reply': 'Auto-Reply',
  flows: 'Flows',
  analytics: 'Analytics',
  'anti-ban': 'Anti-Ban',
  'ai-studio': 'AI Studio',
  settings: 'Settings',
  team: 'Team',
  billing: 'Billing',
  api: 'API',
  new: 'New',
}

function humanizeSegment(segment: string) {
  return breadcrumbLabels[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function TopBar({ onMenuToggle, showMenuButton }: TopBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    const crumbs = segments.map((segment, index) => ({
      label: humanizeSegment(segment),
      href: `/${segments.slice(0, index + 1).join('/')}`,
    }))

    return crumbs.length > 0 ? crumbs : [{ label: 'Dashboard', href: '/dashboard' }]
  }, [pathname])

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {showMenuButton ? (
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 border-slate-200"
              onClick={onMenuToggle}
            >
              <Menu className="h-5 w-5" />
            </Button>
          ) : null}

          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base">
                WA Intelligence - A Product of IERE, Developed by Ayaz Khan
              </h1>
            </div>

            <nav className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500 sm:text-sm">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.href} className="flex items-center gap-1">
                  {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" /> : null}
                  <button
                    className={index === breadcrumbs.length - 1 ? 'font-medium text-slate-800' : 'transition hover:text-slate-700'}
                    disabled={index === breadcrumbs.length - 1}
                    onClick={() => router.push(crumb.href)}
                  >
                    {crumb.label}
                  </button>
                </div>
              ))}
            </nav>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50">
              <Avatar size="default">
                <AvatarFallback>{getInitials(user?.email || 'WA')}</AvatarFallback>
              </Avatar>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-medium text-slate-900">{user?.email || 'User'}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{user?.role || 'member'}</p>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <UserCircle2 className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SetupBanner />
    </header>
  )
}
