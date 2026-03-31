export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface DatabaseRecord {
  id: string
  created_at?: string
  updated_at?: string
}
