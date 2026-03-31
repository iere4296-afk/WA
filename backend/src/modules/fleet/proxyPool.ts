interface ProxyEntry {
  url: string
  failures: number
  lastUsedAt?: string
}

const proxyBuckets = new Map<string, ProxyEntry[]>()

export const proxyPool = {
  seed(orgId: string, proxyUrls: string[]) {
    proxyBuckets.set(orgId, proxyUrls.map((url) => ({ url, failures: 0 })))
  },

  getNextProxy(orgId: string): string | null {
    const bucket = proxyBuckets.get(orgId) ?? []
    if (bucket.length === 0) {
      return null
    }

    bucket.sort((left, right) => left.failures - right.failures)
    const next = bucket[0]
    next.lastUsedAt = new Date().toISOString()
    return next.url
  },

  reportFailure(orgId: string, proxyUrl: string) {
    const bucket = proxyBuckets.get(orgId) ?? []
    const proxy = bucket.find((entry) => entry.url === proxyUrl)
    if (proxy) {
      proxy.failures += 1
    }
  },

  reportSuccess(orgId: string, proxyUrl: string) {
    const bucket = proxyBuckets.get(orgId) ?? []
    const proxy = bucket.find((entry) => entry.url === proxyUrl)
    if (proxy) {
      proxy.failures = 0
      proxy.lastUsedAt = new Date().toISOString()
    }
  },
}
