'use client'

import { useState } from 'react'
import { createBankAccount } from '@/app/actions/bank'

interface BankAccountFormProps {
    accountingAccounts: any[]
    onSuccess: () => void
}

export default function BankAccountForm({ accountingAccounts, onSuccess }: BankAccountFormProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const form = e.currentTarget
        const formData = new FormData(form)
        const result = await createBankAccount(formData)

        if (result?.error) {
            setError(result.error)
        } else {
            onSuccess()
            form.reset()
        }
        setLoading(false)
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Nueva Cuenta Bancaria</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre de la Cuenta *</label>
                    <input
                        name="account_name"
                        required
                        placeholder="Ej: Banesco Corriente"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Banco</label>
                    <input
                        name="bank_name"
                        placeholder="Ej: Banesco"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Número de Cuenta (opcional)</label>
                    <input
                        name="account_number"
                        placeholder="Últimos 4 dígitos"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Moneda</label>
                    <select name="currency" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900">
                        <option value="VES">Bolívares (VES)</option>
                        <option value="USD">Dólares (USD)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Cuenta Contable Asociada *</label>
                    <select name="accounting_account_id" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900">
                        <option value="">Seleccionar cuenta...</option>
                        {accountingAccounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Saldo Inicial</label>
                    <input
                        name="initial_balance"
                        type="number"
                        step="0.01"
                        defaultValue="0.00"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                </div>
            </div>

            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

            <div className="flex justify-end pt-2">
                <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                    {loading ? 'Guardando...' : 'Crear Cuenta'}
                </button>
            </div>
        </form>
    )
}
