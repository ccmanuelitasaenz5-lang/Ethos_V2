'use client'
import { useState } from 'react'
import { createAccount, AccountType } from '@/app/actions/accounting'

export default function AccountForm({ onSuccess }: { onSuccess?: () => void }) {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
        async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setMessage('')
        try {
            const formData = new FormData(e.currentTarget)
            const result = await createAccount(formData)
            if (result.error) {
                setMessage(`Error: ${result.error}`)
            } else {
                setMessage('Cuenta creada con éxito')
                e.currentTarget.reset()
                onSuccess?.()
            }
        } catch (err) {
            console.error('Error inesperado al crear cuenta:', err)
            setMessage('Error inesperado. Revisa la consola o inténtalo de nuevo.')
        } finally {
            setLoading(false)
        }
        }
    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 uppercase">Nueva Cuenta Manual</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-700">Código</label>
                    <input name="code" placeholder="Ej: 1.1.07" required className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm h-9 px-2" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700">Nombre</label>
                    <input name="name" placeholder="Ej: Banco Mercantil" required className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm h-9 px-2" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700">Tipo Principal</label>
                    <select name="main_type" required className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm h-9 px-2">
                        <option value="ASSET">Activo</option>
                        <option value="LIABILITY">Pasivo</option>
                        <option value="EQUITY">Patrimonio</option>
                        <option value="INCOME">Ingreso</option>
                        <option value="EXPENSE">Gasto</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700">Cuenta de Movimiento</label>
                    <select name="is_movement" required className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm h-9 px-2">
                        <option value="true">Sí (Recibe asientos)</option>
                        <option value="false">No (Es de nivel superior)</option>
                    </select>
                </div>
            </div>
            <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
                {loading ? 'Guardando...' : 'Crear Cuenta'}
            </button>
            {message && <p className={`text-xs ${message.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}
        </form>
    )
}