import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Inter, JetBrains_Mono, Geist } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { SkeletonPage } from '@/components/shared/SkeletonPage'
import { Toaster } from 'sonner'
import { cn } from '@/lib/utils'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'WA Intelligence Platform',
  description: 'WhatsApp bulk messaging SaaS platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn(inter.variable, jetbrainsMono.variable, geist.variable, 'font-sans')}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <Suspense fallback={<div className="px-4 py-6"><SkeletonPage showHeader={false} rows={4} /></div>}>
            {children}
          </Suspense>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </body>
    </html>
  )
}
