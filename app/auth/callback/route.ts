import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Esta ruta es el paso que faltaba en el flujo de "Olvidé mi contraseña" (y
// también sirve para confirmación de email si se usa a futuro).
//
// Supabase, al usar @supabase/ssr con flujo PKCE (el que usa este proyecto),
// no entrega una sesión activa directamente en el enlace del correo. Entrega
// un parámetro `?code=...` que DEBE intercambiarse por una sesión real
// llamando a `exchangeCodeForSession`. Sin este paso, la página
// /reset-password nunca tiene una sesión válida y `updateUser({ password })`
// falla con "Auth session missing" (o similar), impidiendo restablecer la
// contraseña.
//
// Flujo correcto:
// 1. Usuario pide reset en /forgot-password
// 2. Supabase envía correo con link a /auth/callback?code=XXXX&next=/reset-password
// 3. Este handler intercambia el code por una sesión (setea cookies)
// 4. Redirige a /reset-password, ya con sesión activa
// 5. El usuario cambia su contraseña exitosamente

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/reset-password'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }

    // El código es inválido o expiró (los links de recuperación caducan)
    return NextResponse.redirect(
      `${origin}/forgot-password?error=El enlace de recuperación es inválido o expiró. Solicita uno nuevo.`
    )
  }

  // No llegó ningún código: acceso directo no válido
  return NextResponse.redirect(`${origin}/login`)
}
