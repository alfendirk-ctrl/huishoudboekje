import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || ''

export const supabase = SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_ANON) : null

// ── Storage helpers ──────────────────────────────────────────────────
// Upserts a single row with key + value into the `storage` table.
// Falls back to localStorage if Supabase is not configured.

export async function dbLoad(key, def) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('storage')
        .select('value')
        .eq('key', key)
        .maybeSingle()
      if (error) throw error
      return data ? JSON.parse(data.value) : def
    } catch (e) {
      console.warn('Supabase load failed, using localStorage', e)
    }
  }
  // localStorage fallback
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : def
  } catch { return def }
}

export async function dbSave(key, value) {
  const json = JSON.stringify(value)
  if (supabase) {
    try {
      const { error } = await supabase
        .from('storage')
        .upsert({ key, value: json }, { onConflict: 'key' })
      if (error) throw error
      return
    } catch (e) {
      console.warn('Supabase save failed, using localStorage', e)
    }
  }
  // localStorage fallback
  try { localStorage.setItem(key, json) } catch {}
}
