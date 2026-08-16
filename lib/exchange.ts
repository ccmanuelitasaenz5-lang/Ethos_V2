'use server'

import { createClient } from '@/lib/supabase/server'

// Tasa de respaldo de última instancia (solo si la API externa Y la BD fallan)
const FALLBACK_RATE = 515.18

// ── Obtener tasa BCV desde DolarAPI (fuente oficial BCV, JSON estable) ──
async function fetchBCVRate(): Promise<number> {
  const timeoutMs = 8000

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      signal: controller.signal,
      cache: 'no-store'
    })
    clearTimeout(timeout)

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    const rate = Number(data.promedio)

    if (!rate || isNaN(rate) || rate <= 0) {
      throw new Error('Tasa inválida recibida de la API')
    }

    console.log(`[BCV] Tasa obtenida de DolarAPI: ${rate}`)
    return rate

  } catch (error) {
    console.error('[BCV] Error al obtener tasa de DolarAPI:', (error as Error).message)
    throw error
  }
}

// ── Obtener tasa del día (con persistencia) ─────────────────────
export async function getTodayRate(): Promise<number> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // 1. Buscar en BD primero (columna real: "rate")
  const { data: stored } = await supabase
    .from('exchange_rates')
    .select('rate')
    .eq('date', today)
    .maybeSingle()

  if (stored) return stored.rate

  // 2. No está en BD — consultar la API y guardar
  let rate: number
  try {
    rate = await fetchBCVRate()
  } catch {
    // Si la API externa falla, usar la última tasa conocida en BD antes que el fallback fijo
    const { data: closest } = await supabase
      .from('exchange_rates')
      .select('rate')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    rate = closest?.rate ?? FALLBACK_RATE
    console.warn(`[BCV] Usando última tasa conocida como respaldo: ${rate}`)
  }

  const { error: upsertError } = await supabase
    .from('exchange_rates')
    .upsert({ date: today, rate: rate, source: 'BCV', currency: 'USD' }, { onConflict: 'currency,date' })

  if (upsertError) console.error('[BCV] Error al guardar tasa:', upsertError.message)

  return rate
}

// ── Tasa pública (sin caché problemático) ───────────────────────
export const getBCVRate = async () => {
  return getTodayRate()
}

// ── Tasa de una fecha específica ────────────────────────────────
export async function getRateForDate(date: string): Promise<number> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('exchange_rates')
    .select('rate')
    .eq('date', date)
    .maybeSingle()

  if (!data) {
    const { data: closest } = await supabase
      .from('exchange_rates')
      .select('rate, date')
      .lt('date', date)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    return closest?.rate ?? FALLBACK_RATE
  }

  return data.rate
}