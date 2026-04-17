'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LibroDigitalPage() {
    const [status, setStatus] = useState('Iniciando diagnóstico...')
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        async function checkAuth() {
            const supabase = createClient()
            
            setStatus('1. Verificando sesión en el navegador...')
            
            // Intento 1: Obtener usuario directamente
            const { data: { user }, error } = await supabase.auth.getUser()

            if (error || !user) {
                setStatus(`❌ Error de Auth: ${error?.message || 'Usuario no encontrado'}`)
                
                // Si falla, intentamos refrescar la sesión
                setStatus('Intentando refrescar sesión...')
                const { data: { session } } = await supabase.auth.getSession()
                
                if (!session) {
                    setStatus('❌ Sesión inválida o expirada. Redirigiendo al login...')
                    setTimeout(() => {
                        router.push('/login?redirectTo=/dashboard/libro-digital')
                    }, 2000)
                    return
                }
                setUserEmail(session.user.email)
                setStatus(`✅ Sesión recuperada: ${session.user.email}`)
            } else {
                setUserEmail(user.email)
                setStatus(`✅ Usuario autenticado: ${user.email}`)
            }
        }

        checkAuth()
    }, [router])

    return (
        <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center justify-center">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full border border-gray-200">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">🔍 Diagnóstico de Autenticación</h1>
                
                <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-blue-800">Estado actual:</p>
                        <p className="text-lg font-mono text-blue-900 mt-1">{status}</p>
                    </div>

                    {userEmail && (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-sm font-medium text-green-800">Usuario detectado:</p>
                            <p className="text-lg font-mono text-green-900 mt-1">{userEmail}</p>
                        </div>
                    )}

                    <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
                        <p><strong>Interpretación:</strong></p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Si ves <strong>✅ Usuario autenticado</strong>: El problema NO es la sesión. Es un error interno al cargar las tablas.</li>
                            <li>Si te <strong>redirige al login</strong>: Tu sesión expiró. Vuelve a loguearte y prueba de nuevo.</li>
                            <li>Si se queda en <strong>❌ Sesión inválida</strong>: Hay un problema con las cookies o el dominio local.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}