'use server'

import { createClient } from '@/lib/supabase/server'

// Tasa de respaldo actualizada (Mayo 2026)
const FALLBACK_RATE = 515.18

// ── Scraping BCV con timeout y reintentos ────────────────────────
async function scrapeBCVRate(): Promise<number> {
  const maxRetries = 3
  const timeoutMs = 8000 // Aumentado a 8 segundos
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[BCV] Intento ${attempt}/${maxRetries}`)
    
    try {
      const rate = await new Promise<number>((resolve, reject) => {
        const https = require('https')
        const options = {
          hostname: 'www.bcv.org.ve',
          port: 443,
          path: '/',
          method: 'GET',
          timeout: timeoutMs,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html',
            'Connection': 'keep-alive'
          }
        }
        
        const req = https.request(options, (res: any) => {
          let data = ''
          res.on('data', (chunk: any) => { data += chunk })
          res.on('end', () => {
            // Patrones actualizados para el sitio del BCV
            const patterns = [
              /id="dolar"[\s\S]*?<strong>\s*([\d,.]+)\s*<\/strong>/i,
              /div\s+id="dolar"[\s\S]*?([\d,.]+)/i,
              /Dolar.*?([\d,.]+)/i
            ]
            
            for (const pattern of patterns) {
              const match = data.match(pattern)
              if (match?.[1]) {
                const rate = parseFloat(match[1].replace(',', '.'))
                if (!isNaN(rate) && rate > 0 && rate < 1000) {
                  console.log(`[BCV] Tasa encontrada con patrón: ${rate}`)
                  resolve(rate)
                  return
                }
              }
            }
            
            console.warn('[BCV] No se encontró la tasa en el HTML')
            reject(new Error('Pattern not found'))
          })
        })
        
        req.on('timeout', () => {
          req.destroy()
          reject(new Error('Timeout'))
        })
        
        req.on('error', (e: any) => {
          reject(new Error(e.message || 'Request failed'))
        })
        
        req.end()
      })
      
      return rate
      
    } catch (error) {
      console.warn(`[BCV] Error en intento ${attempt}:`, (error as Error).message)
      if (attempt === maxRetries) {
        console.error('[BCV] Todos los intentos fallaron, usando fallback:', FALLBACK_RATE)
        return FALLBACK_RATE
      }
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
  
  return FALLBACK_RATE
}

// ── Obtener tasa del día (con persistencia) ─────────────────────
export async function getTodayRate(): Promise<number> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // 1. Buscar en BD primero
  const { data: stored } = await supabase
    .from('exchange_rates')
    .select('rate_usd_ves')
    .eq('date', today)
    .maybeSingle()

  if (stored) return stored.rate_usd_ves

  // 2. No está en BD — hacer scraping y guardar
  const rate = await scrapeBCVRate()
  await supabase.from('exchange_rates').upsert({
    date: today, rate_usd_ves: rate, source: 'BCV'
  }, { onConflict: 'date' })

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
    .select('rate_usd_ves')
    .eq('date', date)
    .maybeSingle()

  if (!data) {
    const { data: closest } = await supabase
      .from('exchange_rates')
      .select('rate_usd_ves, date')
      .lt('date', date)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    return closest?.rate_usd_ves ?? FALLBACK_RATE
  }

  return data.rate_usd_ves
}