'use client'

import { useState } from 'react'
import { createBankTransaction } from '@/app/actions/bank'

interface BankTransactionFormProps {
    bankAccountId: string
    onSuccess: () => void
    onCancel: () => void
}

export default function BankTransactionForm({ bankAccountId, onSuccess, onCancel }: BankTransactionFormProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const form = e.currentTarget  // ← captura la referencia ANTES del await
        const formData = new FormData(form)
        formData.append('bank_account_id', bankAccountId)

        // El monto debe ser negativo para egresos y comisiones
        const type = formData.get('transaction_type') as string
        const amountInput = formData.get('amount') as string
        let amount = parseFloat(amountInput)

        if ((type === 'expense' || type === 'fee') && amount > 0) {
            amount = -amount
            formData.set('amount', amount.toString())
        } else if (type === 'income' && amount < 0) {
            amount = Math.abs(amount)
            formData.set('amount', amount.toString())
        }

        const result = await createBankTransaction(formData)

        if (result?.error) {
            setError(result.error)
        } else {
            onSuccess()
            form.reset()
        }
        setLoading(false)
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-primary-100 shadow-md space-y-4 mb-6">
            <h3 className="text-lg font-bold text-gray-900 border-b border-primary-50 pb-2">Nuevo Movimiento Bancario</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Fecha *</label>
                    <input
                        type="date"
                        name="date"
                        required
                        defaultValue={new Date().toISOString().split('T')[0]}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Tipo de Movimiento *</label>
                    <select name="transaction_type" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900">
                        <option value="expense">Egreso / Pago (-)</option>
                        <option value="income">Ingreso / Depósito (+)</option>
                        <option value="fee">Comisión Bancaria (-)</option>
                        <option value="transfer">Transferencia</option>
                    </select>
                </div>
                <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Descripción / Concepto *</label>
                    <input
                        name="description"
                        required
                        placeholder="Ej: Pago de servicios o Transferencia recibida"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Monto *</label>
                    <input
                        name="amount"
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-bold"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Referencia</label>
                    <input
                        name="reference"
                        placeholder="Ej: 987654"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                </div>
            </div>

            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

            <div className="flex justify-end space-x-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                    {loading ? 'Guardando...' : 'Registrar Movimiento'}
                </button>
            </div>
        </form>
    )
}
