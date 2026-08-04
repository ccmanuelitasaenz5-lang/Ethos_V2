'use client'

import { useState } from 'react'
import { updatePassword } from '@/app/actions/auth'
import Link from 'next/link'
import Logo from '@/components/brand/Logo'

export default function ResetPasswordPage() {
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setMessage(null)

        const result = await updatePassword(formData)

        if (result?.error) {
            setMessage({ type: 'error', text: result.error })
            setLoading(false)
        } else {
            setMessage({ type: 'success', text: 'Contraseña actualizada correctamente.' })
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-2xl">
                <div className="text-center flex flex-col items-center">
                    <Logo className="w-16 h-16 shadow-lg rounded-xl mb-4" vertical={true} />
                    <h2 className="text-2xl font-bold text-gray-900">Nueva contraseña</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Ingresa tu nueva contraseña para acceder al sistema.
                    </p>
                </div>

                <form action={handleSubmit} className="mt-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Nueva Contraseña
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                minLength={8}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                                placeholder="••••••••"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Mínimo 8 caracteres, con al menos una mayúscula, una minúscula y un número.
                            </p>
                        </div>
                    </div>

                    {message && (
                        <div className={`px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                            {message.text}
                            {message.type === 'success' && (
                                <div className="mt-2">
                                    <Link href="/login" className="font-bold underline">
                                        Ir al login
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}

                    {!message?.text || message.type === 'error' ? (
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Actualizando...' : 'Restablecer contraseña'}
                        </button>
                    ) : null}
                </form>
            </div>
        </div>
    )
}
