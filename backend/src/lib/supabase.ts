import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

const sharedOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
}

export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  sharedOptions,
)

// Password-based auth flows should use the public anon key rather than service_role.
export const supabaseAuth = config.supabase.anonKey
  ? createClient(config.supabase.url, config.supabase.anonKey, sharedOptions)
  : null
