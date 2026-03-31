import type { NextConfig } from 'next'
import type { RemotePattern } from 'next/dist/shared/lib/image-config'

function toRemotePattern(value: string | undefined): RemotePattern | null {
  if (!value) return null

  try {
    const url = new URL(value)
    return {
      protocol: url.protocol === 'https:' ? 'https' : 'http',
      hostname: url.hostname,
      port: url.port || '',
      pathname: '/**',
    }
  } catch {
    return null
  }
}

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '')
const isDevelopment = process.env.NODE_ENV === 'development'

const imageRemotePatterns: RemotePattern[] = [
  toRemotePattern(apiBaseUrl),
  toRemotePattern(process.env.NEXT_PUBLIC_SUPABASE_URL),
  {
    protocol: 'http',
    hostname: 'localhost',
    port: '3001',
    pathname: '/**',
  },
  {
    protocol: 'http',
    hostname: '127.0.0.1',
    port: '3001',
    pathname: '/**',
  },
].filter((pattern): pattern is RemotePattern => Boolean(pattern))

const nextConfig: NextConfig = {
  // Keep dev and production build artifacts separate so a local build
  // can't corrupt the active dev manifest during page reloads.
  distDir: isDevelopment ? '.next-dev' : '.next',
  devIndicators: false,
  reactStrictMode: true,
  images: {
    remotePatterns: imageRemotePatterns,
  },
  // Required for xlsx package in browser
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Tell webpack NOT to try to bundle Node.js-only modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
        assert: false,
        os: false,
      }
    }
    return config
  },
  // Allow xlsx to be imported in client components
  transpilePackages: [],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
