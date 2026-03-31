'use client'

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DM_Mono, Inter, Syne } from 'next/font/google'
import {
  Bot,
  Eye,
  EyeOff,
  Info,
  LockKeyhole,
  Mail,
  Send,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

const displayFont = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
})

const bodyFont = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-body',
})

const monoFont = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-mono',
})

const LOGO_URL = 'https://www.investmentexperts.ae/logo.png'
const COMPANY_NAME = 'Investment Experts Real Estate Broker LLC'
const DEVELOPER_CREDIT = 'Ayaz Khan · Dubai, UAE'

type FeedStatus = 'sent' | 'queued' | 'failed'

interface FeedItem {
  id: string
  status: FeedStatus
  name: string
  score: string
}

const INITIAL_FEED: FeedItem[] = [
  { id: 'feed-1', status: 'sent', name: 'Campaign - Dubai Marina Leads', score: '847' },
  { id: 'feed-2', status: 'queued', name: 'Follow-up Seq - JVC Prospects', score: '312' },
  { id: 'feed-3', status: 'sent', name: 'A/B Test - Off-Plan Launch', score: '2.1K' },
  { id: 'feed-4', status: 'queued', name: 'Broadcast - Investor List', score: '5.6K' },
]

const FEED_TIMES = ['now', '8s ago', '14s ago', '21s ago']
const FEED_CAMPAIGNS = [
  'Dubai Marina Leads',
  'JVC Prospects',
  'Off-Plan Launch',
  'Investor List',
  'Palm Jumeirah Seq',
  'Downtown Broadcast',
  'Business Bay Warm-Up',
  'DIFC Outreach',
]

function formatCompactCount(value: number) {
  return value > 999 ? `${(value / 1000).toFixed(1)}K` : String(value)
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn, session, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedItems, setFeedItems] = useState<FeedItem[]>(INITIAL_FEED)

  const redirectTarget = searchParams.get('redirect') || '/dashboard'
  const year = useMemo(() => new Date().getFullYear(), [])

  useEffect(() => {
    if (!loading && session) {
      router.replace(redirectTarget)
    }
  }, [loading, redirectTarget, router, session])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const status: FeedStatus = Math.random() > 0.2 ? (Math.random() > 0.5 ? 'sent' : 'queued') : 'failed'
      const campaign = FEED_CAMPAIGNS[Math.floor(Math.random() * FEED_CAMPAIGNS.length)]
      const count = Math.floor(Math.random() * 9000 + 100)

      setFeedItems((current) => [
        {
          id: `feed-${Date.now()}`,
          status,
          name: `Campaign - ${campaign}`,
          score: formatCompactCount(count),
        },
        ...current,
      ].slice(0, 4))
    }, 3500)

    return () => window.clearInterval(interval)
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    try {
      await signIn(email, password)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  const stats = [
    { label: 'Max Contacts', value: '10M+', icon: Send, valueClass: 'text-[#25D453]' },
    { label: 'Anti-Ban Rules', value: '80', icon: Shield, valueClass: 'text-[#25D453]' },
    { label: 'AI Filter', value: '5-Gate', icon: Bot, valueClass: 'text-[#D4A017]' },
  ]

  const features = [
    { label: 'Anti-Ban Active', tone: 'green' },
    { label: 'AI Filter ON', tone: 'green' },
    { label: 'Multi-Device', tone: 'gold' },
    { label: 'Real-Time', tone: 'green' },
    { label: 'A/B Testing', tone: 'gold' },
  ]

  return (
    <div className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} relative min-h-screen overflow-hidden bg-[#080A08] text-[#E8F0E8]`}>
      <style jsx global>{`
        nextjs-portal {
          display: none !important;
        }
      `}</style>
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(37,212,83,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(37,212,83,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_60%_70%_at_20%_50%,rgba(37,212,83,0.04)_0%,transparent_60%),radial-gradient(ellipse_40%_50%_at_80%_80%,rgba(212,160,23,0.04)_0%,transparent_60%)]" />
      <div className="pointer-events-none fixed inset-0 z-10 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.04)_2px,rgba(0,0,0,0.04)_4px)]" />

      <div className="relative z-20 min-h-screen xl:grid xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex flex-col border-b border-[rgba(37,212,83,0.12)] px-6 py-9 xl:border-b-0 xl:border-r xl:px-12">
          <div className="relative mb-14 flex min-h-[72px] items-center justify-center">
            <div className="absolute left-0 top-1/2 flex h-[72px] w-[72px] -translate-y-1/2 items-center justify-center overflow-hidden rounded-[18px] border border-[rgba(37,212,83,0.44)] bg-[#0E110E] shadow-[0_0_0_1px_rgba(37,212,83,0.12),0_0_28px_rgba(37,212,83,0.22),0_0_56px_rgba(212,160,23,0.10),0_18px_38px_rgba(0,0,0,0.34)]">
              <img
                src={LOGO_URL}
                alt="Investment Experts logo"
                className="h-14 w-14 object-contain drop-shadow-[0_0_16px_rgba(37,212,83,0.32)]"
              />
            </div>
            <div className="text-center">
              <div className="font-[var(--font-display)] text-[28px] font-extrabold tracking-[0.07em] text-[#F3F8F3] [text-shadow:0_0_10px_rgba(37,212,83,0.18),0_0_24px_rgba(37,212,83,0.18),0_0_36px_rgba(212,160,23,0.08)] sm:text-[32px]">
                WA INTELLIGENCE
              </div>
              <div className="mt-1.5 font-[var(--font-mono)] text-[14px] uppercase tracking-[0.14em] text-[#D2DDD2] [text-shadow:0_0_12px_rgba(37,212,83,0.14)] sm:text-[15px]">
                by Investment Experts Real Estate
              </div>
            </div>
          </div>

          <div className="mb-7 inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(37,212,83,0.12)] bg-[rgba(37,212,83,0.08)] px-3.5 py-1.5 font-[var(--font-mono)] text-[11px] tracking-[0.06em] text-[#25D453]">
            <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-[#25D453] shadow-[0_0_8px_rgba(37,212,83,1)]" />
            WhatsApp Bulk SaaS · AI-Powered · Anti-Ban Engine
          </div>

          <h1 className="mb-4 font-[var(--font-display)] text-[clamp(24px,2.45vw,42px)] font-extrabold leading-[1.02] tracking-[-0.03em] sm:whitespace-nowrap">
            <span className="text-[#25D453]">REACH MILLIONS.</span>{' '}
            <span className="text-[#D4A017]">STAY INVISIBLE.</span>{' '}
            <span className="text-[#E8F0E8]">CLOSE DEALS.</span>
          </h1>

          <p className="mb-9 max-w-[420px] text-sm leading-6 text-[#6B7A6B]">
            Multi-tenant WhatsApp bulk messaging platform engineered for scale - 80-rule anti-ban engine, AI content
            filters, real-time delivery intelligence, and campaign automation built for Dubai&apos;s real estate market.
          </p>

          <div className="mb-11 grid gap-3 sm:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon

              return (
                <div
                  key={stat.label}
                  className="group relative overflow-hidden rounded-xl border border-[rgba(37,212,83,0.12)] bg-[#0E110E] px-[18px] py-4 transition-colors hover:border-[rgba(37,212,83,0.30)]"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#25D453,transparent)] opacity-0 transition-opacity group-hover:opacity-100" />
                  <Icon className="mb-2 h-[18px] w-[18px] text-[#6B7A6B]" />
                  <div className={`font-[var(--font-display)] text-[22px] font-extrabold tracking-[-0.02em] ${stat.valueClass}`}>{stat.value}</div>
                  <div className="mt-1 font-[var(--font-mono)] text-[9px] uppercase tracking-[0.08em] text-[#6B7A6B]">{stat.label}</div>
                </div>
              )
            })}
          </div>

          <div className="mb-3 flex items-center gap-2">
            <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-[#25D453] shadow-[0_0_6px_rgba(37,212,83,1)]" />
            <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[#6B7A6B]">Live Message Activity Feed</span>
          </div>

          <div className="flex flex-col gap-2">
            {feedItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-2.5 rounded-lg border border-[rgba(37,212,83,0.12)] bg-[#0E110E] px-3.5 py-2.5"
              >
                <span
                  className={`rounded px-[7px] py-[2px] font-[var(--font-mono)] text-[9px] font-medium uppercase tracking-[0.05em] ${
                    item.status === 'sent'
                      ? 'bg-[rgba(37,212,83,0.12)] text-[#25D453]'
                      : item.status === 'queued'
                        ? 'bg-[rgba(212,160,23,0.12)] text-[#D4A017]'
                        : 'bg-[rgba(255,69,69,0.12)] text-[#FF4545]'
                  }`}
                >
                  {item.status}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#E8F0E8]">{item.name}</span>
                <span className="shrink-0 font-[var(--font-mono)] text-[10px] text-[#3D4D3D]">{FEED_TIMES[index] || 'now'}</span>
                <span
                  className={`shrink-0 font-[var(--font-display)] text-sm font-bold ${
                    item.status === 'queued' ? 'text-[#D4A017]' : item.status === 'failed' ? 'text-[#FF4545]' : 'text-[#25D453]'
                  }`}
                >
                  {item.status === 'queued' ? 'Q' : item.status === 'failed' ? '!' : 'OK'} {item.score}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-auto flex justify-center border-t border-[rgba(37,212,83,0.12)] pt-6">
            <div className="text-center font-[var(--font-mono)] text-[11px] tracking-[0.045em] text-[#7E8E7E] sm:text-[12px]">
              <span className="whitespace-nowrap">
                &copy; {year} <span className="text-[#C7D3C7]">{COMPANY_NAME}</span>{' '}
                <span className="text-[#5F6F5F]">|</span>{' '}
                <span className="text-[#E8F0E8]">{`Developed by ${DEVELOPER_CREDIT}`}</span>
              </span>
            </div>
          </div>
        </section>

        <section className="relative flex flex-col overflow-hidden bg-[#0E110E] px-6 py-9 xl:px-10">
          <div className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(37,212,83,1)_40%,rgba(212,160,23,1)_70%,transparent)] opacity-25" />

          <div className="relative z-10 mb-9 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <img
                src={LOGO_URL}
                alt="Investment Experts logo"
                className="h-8 w-8 rounded-md object-contain drop-shadow-[0_0_10px_rgba(37,212,83,0.22)]"
              />
              <div className="font-[var(--font-display)] text-[13px] font-bold text-[#E8F0E8]">Investment Experts</div>
            </div>
            <span className="rounded border border-[rgba(37,212,83,0.12)] bg-[rgba(37,212,83,0.08)] px-2.5 py-[3px] font-[var(--font-mono)] text-[10px] tracking-[0.06em] text-[#25D453]">
              v5.0
            </span>
          </div>

          <h2 className="relative z-10 mb-1 font-[var(--font-display)] text-[26px] font-extrabold tracking-[-0.02em] text-[#E8F0E8]">Welcome back</h2>
          <p className="relative z-10 mb-7 text-[13px] leading-5 text-[#6B7A6B]">Sign in to your WA Intelligence dashboard</p>

          <div className="relative z-10 mb-7 flex flex-wrap gap-[7px]">
            {features.map((feature) => (
              <div
                key={feature.label}
                className="inline-flex items-center gap-[5px] rounded border border-[rgba(37,212,83,0.12)] bg-[#141814] px-2.5 py-1 font-[var(--font-mono)] text-[9px] uppercase tracking-[0.06em] text-[#6B7A6B]"
              >
                <span className={`h-[5px] w-[5px] rounded-full ${feature.tone === 'gold' ? 'bg-[#D4A017]' : 'bg-[#25D453]'}`} />
                {feature.label}
              </div>
            ))}
          </div>

          <div className="relative z-10 mb-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[rgba(37,212,83,0.12)]" />
            <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[#3D4D3D]">Secure Login</span>
            <div className="h-px flex-1 bg-[rgba(37,212,83,0.12)]" />
          </div>

          <form className="relative z-10 flex flex-col gap-3.5" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1.5">
              <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[#6B7A6B]">Email Address</span>
              <div className="relative flex items-center">
                <Mail className="pointer-events-none absolute left-3.5 h-[14px] w-[14px] text-[#3D4D3D]" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                  className="h-[46px] w-full rounded-lg border border-[rgba(37,212,83,0.12)] bg-[#141814] px-10 text-[13px] text-[#E8F0E8] outline-none transition focus:border-[rgba(37,212,83,0.30)] focus:shadow-[0_0_0_3px_rgba(37,212,83,0.08)]"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[#6B7A6B]">Password</span>
              <div className="relative flex items-center">
                <LockKeyhole className="pointer-events-none absolute left-3.5 h-[14px] w-[14px] text-[#3D4D3D]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  className="h-[46px] w-full rounded-lg border border-[rgba(37,212,83,0.12)] bg-[#141814] px-10 pr-10 text-[13px] text-[#E8F0E8] outline-none transition focus:border-[rgba(37,212,83,0.30)] focus:shadow-[0_0_0_3px_rgba(37,212,83,0.08)]"
                />
                <button
                  type="button"
                  className="absolute right-3.5 inline-flex h-4 w-4 items-center justify-center text-[#3D4D3D] transition hover:text-[#6B7A6B]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 font-[var(--font-mono)] text-[10px] tracking-[0.04em] text-[#6B7A6B]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-[#25D453]"
                />
                <span>Remember me on this device</span>
              </label>

              <button type="button" className="font-[var(--font-mono)] text-[10px] tracking-[0.04em] text-[#6B7A6B] transition hover:text-[#25D453]">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="relative mt-1 overflow-hidden rounded-lg bg-[#25D453] px-4 py-[13px] font-[var(--font-display)] text-[15px] font-bold tracking-[0.02em] text-[#060A06] transition hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(37,212,83,0.35)] disabled:cursor-wait disabled:opacity-85"
            >
              <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent)]" />
              <span className="relative">{submitting ? 'Signing In...' : 'Sign In to Dashboard ->'}</span>
            </button>

            <div className="flex items-start gap-2.5 rounded-lg border border-[rgba(212,160,23,0.20)] bg-[rgba(212,160,23,0.06)] px-3.5 py-3">
              <Info className="mt-px h-[14px] w-[14px] shrink-0 text-[#D4A017]" />
              <p className="font-[var(--font-mono)] text-[10px] leading-[1.5] tracking-[0.03em] text-[#6B7A6B]">
                <strong className="text-[#D4A017]">Two-factor authentication</strong> is enabled on your account.
                You&apos;ll be prompted for a 6-digit OTP after login.
              </p>
            </div>
          </form>

        </section>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080A08]" />}>
      <LoginPageContent />
    </Suspense>
  )
}
