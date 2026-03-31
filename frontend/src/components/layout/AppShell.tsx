'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

interface AppShellProps {
  children: ReactNode
}

const MOBILE_BREAKPOINT = 768
const COMPACT_BREAKPOINT = 1280
const EXPANDED_WIDTH = 288
const COLLAPSED_WIDTH = 80

export function AppShell({ children }: AppShellProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth
      const nextIsMobile = width < MOBILE_BREAKPOINT
      const nextIsCompact = width < COMPACT_BREAKPOINT

      setIsMobile(nextIsMobile)
      setIsCompact(nextIsCompact)
      setCollapsed(nextIsCompact)

      if (!nextIsMobile) {
        setMobileOpen(false)
      }
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)

    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  function handleMenuToggle() {
    if (isMobile) {
      setMobileOpen((current) => !current)
      return
    }

    setCollapsed((current) => !current)
  }

  const sidebarOffset = isMobile ? 0 : collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
        onClose={() => setMobileOpen(false)}
      />

      <div
        className="flex min-h-screen flex-col transition-[margin] duration-300"
        style={{ marginLeft: sidebarOffset }}
      >
        <TopBar onMenuToggle={handleMenuToggle} showMenuButton={isCompact || isMobile} />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
