import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '')

if (!API_URL) {
  console.error('[API] NEXT_PUBLIC_API_URL is not set!')
}

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

if (process.env.NODE_ENV === 'development') {
  api.interceptors.request.use((config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    return config
  })
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const skipAuthRedirect = Boolean((error.config as any)?.skipAuthRedirect)

    if (error.response?.status === 401 && !skipAuthRedirect) {
      console.warn('[API] 401 Unauthorized - redirecting to login')
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
export { api }
