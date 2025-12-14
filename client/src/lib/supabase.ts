import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types for map features
export interface MapFeature {
  id: string
  type: 'marker' | 'polygon' | 'line'
  coordinates: { lat: number; lng: number }[]
  title: string
  description?: string
  color: string
  fillColor?: string
  weight?: number
  created_at?: string
  created_by?: string
}

// Helper function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return supabaseUrl !== 'https://placeholder.supabase.co' && 
         supabaseAnonKey !== 'placeholder-key'
}

// Helper function to get user-friendly error messages
export function getErrorMessage(error: any): string {
  if (error?.message) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred'
}
