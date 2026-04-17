'use client'

import { useState, useEffect } from 'react'
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { getActiveAccounts } from '@/app/actions/accounting' // Importamos la nueva acción
import type { AccountingAccount } from '@/types/database'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface ManualEntryModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (payload: any) => Promise<{ success?: boolean; error?: string }>
}

interface JournalLine {
    id: string
    account_code: string
    account_name: string
    description: string
    debit: number
    credit: number
    debit_ves: number
    credit_ves: number
}

export default function ManualEntryModal({ isOpen, onClose, onSave }: ManualEntryModalProps) {
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [description, setDescription] = useState('')
    const [exchangeRate, setExchangeRate] = useState<number>(0)
    const [lines, setLines] = useState<JournalLine[]>([
        { id: '1', account_code: '', account_name: '', description: '', debit: 0, credit: 0, debit_ves: 0, credit_ves: 0 },
        { id: '2', account_code: '', account_name: '', description: '', debit: 0, credit: 0, debit_ves: 0, credit_ves: 0 }
    ])
    
    // Nuevos estados para manejar la carga de cuentas
    const [accounts, setAccounts] = useState<AccountingAccount[]>([])
    const [loadingAccounts, setLoadingAccounts] = useState(false)
    
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Cargar cuentas activas cuando el modal se abre
    useEffect(() => {
        if (isOpen) {
            loadAccounts()
        }
    }, [isOpen])

    const loadAccounts = async () => {
        setLoadingAccounts(true)
        try {
            const result = await getActiveAccounts()
            if (result.error) {
                toast.error(result.error)
                setAccounts([])
            } else {
                setAccounts(result.data || [])
            }
        } catch (err) {
            console.error('Error cargando cuentas:', err)
            toast.error('No se pudieron cargar las cuentas contables')
            setAccounts([])
        } finally {
            setLoadingAccounts(false)
        }
    }

    // Solo cuentas de movimiento
    const movementAccounts = accounts.filter(a => a.is_movement)

    // Calculate totals
    const totalDebitUSD = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0)
    const totalCreditUSD = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0)
    const totalDebitVES = lines.reduce((sum, line) => sum + (Number(line.debit_ves) || 0), 0)
    const totalCreditVES = lines.reduce((sum, line) => sum + (Number(line.credit_ves) || 0), 0)

    const diffUSD = Math.abs(totalDebitUSD - totalCreditUSD)
    const diffVES = Math.abs(totalDebitVES - totalCreditVES)
    
    // El semáforo considera ambos
    const isBalanced = diffUSD < 0.01 && diffVES < 0.01

    const handleAddLine = () => {
        setLines([...lines, { 
            id: Date.now().toString(), 
            account_code: '', 
            account_name: '', 
            description: '', 
            debit: 0, 
            credit: 0, 
            debit_ves: 0, 
            credit_ves: 0 
        }])
    }

    const handleRemoveLine = (id: string) => {
        if (lines.length > 2) {
            setLines(lines.filter(l => l.id !== id))
        }
    }

    const handleLineChange = (id: string, field: keyof JournalLine, value: any) => {
        setLines(lines.map(line => {
            if (line.id !== id) return line
            
            const updatedLine = { ...line, [field]: value }
            
            // Si cambian cuenta, buscamos el nombre
            if (field === 'account_code') {
                const acc = movementAccounts.find(a => a.code === value)
                if (acc) updatedLine.account_name = acc.name
            }

            // Cálculos automáticos USD -> VES basados en la tasa (si se provee)
            if (exchangeRate > 0) {
                if (field === 'debit') {
                    updatedLine.debit_ves = Number((Number(value) * exchangeRate).toFixed(2))
                    if (Number(value) > 0) updatedLine.credit = 0
                }
                if (field === 'credit') {
                    updatedLine.credit_ves = Number((Number(value) * exchangeRate).toFixed(2))
                    if (Number(value) > 0) updatedLine.debit = 0
                }
            }

            return updatedLine
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isBalanced) {
            setError("El asiento no cuadra. Revisa los saldos USD y VES.")
            return
        }

        setIsSubmitting(true)
        setError(null)

        const payload = {
            date,
            description,
            exchange_rate: exchangeRate,
            items: lines.filter(l => l.account_code && (l.debit > 0 || l.credit > 0 || l.debit_ves > 0 || l.credit_ves > 0)).map(line => ({
                account_code: line.account_code,
                account_name: line.account_name,
                description: line.description || description,
                debit: Number(line.debit) || 0,
                credit: Number(line.credit) || 0,
                debit_ves: Number(line.debit_ves) || 0,
                credit_ves: Number(line.credit_ves) || 0,
            }))
        }

        const res = await onSave(payload)
        
        setIsSubmitting(false)
        if (res.error) {
            setError(res.error)
            toast.error(res.error)
        } else {
            toast.success('Asiento registrado correctamente')
            onClose()
            // Reset state
            setLines([
                { id: '1', account_code: '', account_name: '', description: '', debit: 0, credit: 0, debit_ves: 0, credit_ves: 0 },
                { id: '2', account_code: '', account_name: '', description: '', debit: 0, credit: 0, debit_ves: 0, credit_ves: 0 }
            ])
            setDescription('')
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm overflow-hidden">
            <div className="bg-white rounded-xl shadow-2xl w-11/12 max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-xl font-bold font-heading text-gray-900 flex items-center gap-2">
                        Nuevo Asiento Contable (Manual)
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <form id="journal-entry-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                    {/* Encabezado del asiento */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                            <input
                                type="date"
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tasa de Cambio (BCV)</label>
                            <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">Bs.</span>
                                </div>
                                <input
                                    type="number"
                                    step="0.0001"
                                    required
                                    value={exchangeRate || ''}
                                    onChange={(e) => setExchangeRate(Number(e.target.value))}
                                    className="w-full pl-10 border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="col-span-1 md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Concepto General</label>
                            <input
                                type="text"
                                required
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Concepto general para el asiento"
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            />
                        </div>
                    </div>

                    {/* Tabla de Movimientos */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm mt-2">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 text-left w-64">Cuenta</th>
                                        <th className="px-4 py-3 text-left">Detalle</th>
                                        <th className="px-4 py-3 text-right">Debe ($)</th>
                                        <th className="px-4 py-3 text-right">Haber ($)</th>
                                        <th className="px-4 py-3 text-right bg-blue-50/50">Debe (Bs)</th>
                                        <th className="px-4 py-3 text-right bg-blue-50/50">Haber (Bs)</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {loadingAccounts ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                                Cargando plan de cuentas...
                                            </td>
                                        </tr>
                                    ) : movementAccounts.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-red-500">
                                                No hay cuentas contables activas configuradas. Ve a Configuración para crearlas.
                                            </td>
                                        </tr>
                                    ) : (
                                        lines.map((line, index) => (
                                            <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-2">
                                                    <select
                                                        value={line.account_code}
                                                        onChange={(e) => handleLineChange(line.id, 'account_code', e.target.value)}
                                                        required
                                                        className="w-full text-sm border-gray-300 border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-0 bg-transparent px-0 py-1.5"
                                                    >
                                                        <option value="">Selecciona cuenta...</option>
                                                        {movementAccounts.map(a => (
                                                            <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="text"
                                                        value={line.description}
                                                        onChange={(e) => handleLineChange(line.id, 'description', e.target.value)}
                                                        placeholder="Línea opcional"
                                                        className="w-full text-sm border-gray-300 border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-0 bg-transparent px-0 py-1.5"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={line.debit || ''}
                                                        onChange={(e) => handleLineChange(line.id, 'debit', e.target.value)}
                                                        className="w-full text-right text-sm border-gray-300 border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-0 bg-transparent px-0 py-1.5 text-green-700"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={line.credit || ''}
                                                        onChange={(e) => handleLineChange(line.id, 'credit', e.target.value)}
                                                        className="w-full text-right text-sm border-gray-300 border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-0 bg-transparent px-0 py-1.5 text-red-700"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 bg-blue-50/30">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={line.debit_ves || ''}
                                                        onChange={(e) => handleLineChange(line.id, 'debit_ves', e.target.value)}
                                                        className="w-full text-right text-sm border-gray-300 border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-0 bg-transparent px-0 py-1.5 text-green-700"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 bg-blue-50/30">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={line.credit_ves || ''}
                                                        onChange={(e) => handleLineChange(line.id, 'credit_ves', e.target.value)}
                                                        className="w-full text-right text-sm border-gray-300 border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-0 bg-transparent px-0 py-1.5 text-red-700"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveLine(line.id)}
                                                        disabled={lines.length <= 2}
                                                        className={`p-1 rounded ${lines.length <= 2 ? 'text-gray-300' : 'text-red-500 hover:bg-red-50'}`}
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-50 border-t border-gray-200">
                                    <tr>
                                        <td colSpan={2} className="px-6 py-4">
                                            <button
                                                type="button"
                                                onClick={handleAddLine}
                                                disabled={loadingAccounts || movementAccounts.length === 0}
                                                className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700 gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <PlusIcon className="w-4 h-4" /> Agregar línea
                                            </button>
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono font-bold text-green-700">
                                            $ {totalDebitUSD.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono font-bold text-red-700">
                                            $ {totalCreditUSD.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono font-bold text-green-700 bg-blue-50/50">
                                            Bs {totalDebitVES.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono font-bold text-red-700 bg-blue-50/50">
                                            Bs {totalCreditVES.toFixed(2)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Semáforo de Balance */}
                    <div className={`p-4 rounded-lg flex items-center justify-between border ${isBalanced ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        <div className="flex items-center gap-3">
                            <span className="relative flex h-3 w-3">
                                {!isBalanced && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-3 w-3 ${isBalanced ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            </span>
                            <span className="font-medium text-sm">
                                {isBalanced ? 'El asiento está balanceado correctamente.' : 'Diferencia detectada en las sumas. El asiento no cuadra.'}
                            </span>
                        </div>
                        <div className="text-sm font-mono flex items-center gap-4">
                            {!isBalanced && (
                                <>
                                    <span>Diff USD: {diffUSD.toFixed(2)}</span>
                                    <span>Diff VES: {diffVES.toFixed(2)}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}
                </form>

                <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        form="journal-entry-form"
                        type="submit"
                        disabled={!isBalanced || isSubmitting || totalDebitUSD === 0 || loadingAccounts || movementAccounts.length === 0}
                        className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isSubmitting ? 'Guardando...' : 'Asentar en Diario'}
                    </button>
                </div>
            </div>
        </div>
    )
}