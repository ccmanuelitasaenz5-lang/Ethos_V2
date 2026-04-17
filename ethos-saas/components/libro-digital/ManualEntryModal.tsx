'use client'

import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, TrashIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import {
    getActiveAccounts,
    createManualJournalEntry,
    getLatestExchangeRate,
} from '@/app/actions/accounting'
import type { AccountingAccount } from '@/types/database'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ManualEntryModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    accounts?: AccountingAccount[] // opcional — si se pasa desde la página, se usa
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

const EMPTY_LINE = (): JournalLine => ({
    id: crypto.randomUUID(),
    account_code: '',
    account_name: '',
    description: '',
    debit: 0,
    credit: 0,
    debit_ves: 0,
    credit_ves: 0,
})

// ─── Component ────────────────────────────────────────────────────────────────
export default function ManualEntryModal({
    isOpen,
    onClose,
    onSuccess,
    accounts: accountsProp,
}: ManualEntryModalProps) {

    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [description, setDescription] = useState('')
    const [exchangeRate, setExchangeRate] = useState<number>(0)
    const [rateSource, setRateSource] = useState<string>('')
    const [lines, setLines] = useState<JournalLine[]>([EMPTY_LINE(), EMPTY_LINE()])

    const [accounts, setAccounts] = useState<AccountingAccount[]>(accountsProp ?? [])
    const [loadingAccounts, setLoadingAccounts] = useState(false)
    const [loadingRate, setLoadingRate] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)

    // ─── Cargar cuentas ────────────────────────────────────────────────────────
    const loadAccounts = useCallback(async () => {
        if (accountsProp && accountsProp.length > 0) {
            setAccounts(accountsProp)
            return
        }
        setLoadingAccounts(true)
        try {
            const res = await getActiveAccounts()
            setAccounts(res.data ?? [])
        } catch {
            toast.error('No se pudo cargar el plan de cuentas')
        } finally {
            setLoadingAccounts(false)
        }
    }, [accountsProp])

    // ─── Cargar última tasa de cambio ──────────────────────────────────────────
    const loadExchangeRate = useCallback(async () => {
        setLoadingRate(true)
        try {
            const res = await getLatestExchangeRate()
            setExchangeRate(res.rate)
            setRateSource(res.source)
        } catch {
            toast.error('No se pudo cargar la tasa de cambio')
        } finally {
            setLoadingRate(false)
        }
    }, [])

    // ─── Cuando el modal se abre ───────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return
        loadAccounts()
        loadExchangeRate()
        // Reset formulario
        setDate(format(new Date(), 'yyyy-MM-dd'))
        setDescription('')
        setLines([EMPTY_LINE(), EMPTY_LINE()])
        setSubmitError(null)
    }, [isOpen, loadAccounts, loadExchangeRate])

    // ─── Cuando cambia la tasa, recalcular VES de todas las líneas ────────────
    useEffect(() => {
        if (exchangeRate <= 0) return
        setLines(prev => prev.map(line => ({
            ...line,
            debit_ves: line.debit > 0 ? Number((line.debit * exchangeRate).toFixed(2)) : line.debit_ves,
            credit_ves: line.credit > 0 ? Number((line.credit * exchangeRate).toFixed(2)) : line.credit_ves,
        })))
    }, [exchangeRate])

    // ─── Solo cuentas de movimiento (auxiliares) ───────────────────────────────
    const movementAccounts = accounts.filter(a => a.is_movement)

    // ─── Totales y validación ──────────────────────────────────────────────────
    const totalDebitUSD  = lines.reduce((s, l) => s + (Number(l.debit)      || 0), 0)
    const totalCreditUSD = lines.reduce((s, l) => s + (Number(l.credit)     || 0), 0)
    const totalDebitVES  = lines.reduce((s, l) => s + (Number(l.debit_ves)  || 0), 0)
    const totalCreditVES = lines.reduce((s, l) => s + (Number(l.credit_ves) || 0), 0)

    const diffUSD = Math.abs(totalDebitUSD - totalCreditUSD)
    const diffVES = Math.abs(totalDebitVES - totalCreditVES)
    const isBalanced = diffUSD < 0.01 && diffVES < 0.01 && totalDebitUSD > 0

    // ─── Handlers de líneas ────────────────────────────────────────────────────
    const handleAddLine = () => setLines(prev => [...prev, EMPTY_LINE()])

    const handleRemoveLine = (id: string) => {
        if (lines.length > 2) setLines(prev => prev.filter(l => l.id !== id))
    }

    const handleLineChange = (id: string, field: keyof JournalLine, rawValue: any) => {
        setLines(prev => prev.map(line => {
            if (line.id !== id) return line
            const updated = { ...line, [field]: rawValue }

            // Auto-completar nombre de cuenta
            if (field === 'account_code') {
                const acc = movementAccounts.find(a => a.code === rawValue)
                updated.account_name = acc?.name ?? ''
            }

            // Auto-calcular VES al cambiar montos USD
            if (exchangeRate > 0) {
                const val = Number(rawValue) || 0
                if (field === 'debit') {
                    updated.debit_ves = Number((val * exchangeRate).toFixed(2))
                    if (val > 0) { updated.credit = 0; updated.credit_ves = 0 }
                }
                if (field === 'credit') {
                    updated.credit_ves = Number((val * exchangeRate).toFixed(2))
                    if (val > 0) { updated.debit = 0; updated.debit_ves = 0 }
                }
            }

            return updated
        }))
    }

    // ─── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitError(null)

        if (!isBalanced) {
            setSubmitError('El asiento no cuadra. Verifica que Debe = Haber en USD y VES.')
            return
        }

        const validLines = lines.filter(
            l => l.account_code && (l.debit > 0 || l.credit > 0)
        )
        if (validLines.length < 2) {
            setSubmitError('Se requieren al menos 2 líneas con cuenta y monto.')
            return
        }

        setIsSubmitting(true)
        try {
            const res = await createManualJournalEntry({
                date,
                description,
                exchange_rate: exchangeRate,
                items: validLines.map(l => ({
                    account_code:  l.account_code,
                    account_name:  l.account_name,
                    description:   l.description || description,
                    debit:         Number(l.debit)      || 0,
                    credit:        Number(l.credit)     || 0,
                    debit_ves:     Number(l.debit_ves)  || 0,
                    credit_ves:    Number(l.credit_ves) || 0,
                })),
            })

            if (res.error) {
                setSubmitError(res.error)
                toast.error(res.error)
            } else {
                toast.success(`✅ Asiento N.° ${res.entry_number} registrado correctamente`)
                onSuccess()
            }
        } catch (err: any) {
            setSubmitError('Error inesperado al guardar el asiento.')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) return null

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-2 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">

                {/* ── Header ────────────────────────────────────────────────── */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-white shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Nuevo Asiento Manual</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Libro Diario — Partida bimonetaria (USD / VES)</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Formulario ────────────────────────────────────────────── */}
                <form id="manual-entry-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">

                        {/* Encabezado del asiento */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Fecha */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Fecha</label>
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>

                            {/* Tasa de cambio */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                                    Tasa BCV (Bs/$)
                                    {rateSource && (
                                        <span className="ml-2 font-normal text-primary-600 normal-case">— {rateSource}</span>
                                    )}
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm pointer-events-none">Bs.</span>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            min="0"
                                            required
                                            value={exchangeRate || ''}
                                            onChange={e => setExchangeRate(Number(e.target.value))}
                                            placeholder="0.00"
                                            className="w-full pl-9 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={loadExchangeRate}
                                        disabled={loadingRate}
                                        title="Recargar tasa del sistema"
                                        className="px-2.5 py-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        <ArrowPathIcon className={`w-4 h-4 ${loadingRate ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Concepto */}
                            <div className="sm:col-span-1">
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Concepto general</label>
                                <input
                                    type="text"
                                    required
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Ej: Apertura de libros, Ajuste por inflación..."
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                        </div>

                        {/* Tabla de movimientos */}
                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            <th className="px-4 py-3 text-left min-w-[220px]">Cuenta Contable</th>
                                            <th className="px-4 py-3 text-left min-w-[160px]">Detalle (opcional)</th>
                                            <th className="px-4 py-3 text-right min-w-[110px]">Debe $</th>
                                            <th className="px-4 py-3 text-right min-w-[110px]">Haber $</th>
                                            <th className="px-4 py-3 text-right min-w-[110px] bg-blue-50">Debe Bs</th>
                                            <th className="px-4 py-3 text-right min-w-[110px] bg-blue-50">Haber Bs</th>
                                            <th className="px-4 py-3 w-10" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {loadingAccounts ? (
                                            <tr>
                                                <td colSpan={7} className="py-10 text-center text-gray-400">Cargando plan de cuentas...</td>
                                            </tr>
                                        ) : movementAccounts.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-10 text-center text-amber-600 font-medium">
                                                    ⚠️ No hay cuentas de movimiento configuradas. Ve a Configuración → Plan de Cuentas.
                                                </td>
                                            </tr>
                                        ) : (
                                            lines.map((line, idx) => (
                                                <tr key={line.id} className="hover:bg-gray-50/60 transition-colors group">
                                                    {/* Cuenta */}
                                                    <td className="px-3 py-2">
                                                        <select
                                                            value={line.account_code}
                                                            onChange={e => handleLineChange(line.id, 'account_code', e.target.value)}
                                                            required
                                                            className="w-full text-sm border-0 border-b border-gray-200 focus:border-primary-500 focus:ring-0 bg-transparent py-1 text-gray-800"
                                                        >
                                                            <option value="">Seleccionar cuenta...</option>
                                                            {movementAccounts.map(a => (
                                                                <option key={a.id} value={a.code}>
                                                                    {a.code} — {a.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    {/* Detalle */}
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="text"
                                                            value={line.description}
                                                            onChange={e => handleLineChange(line.id, 'description', e.target.value)}
                                                            placeholder="Detalle opcional"
                                                            className="w-full text-sm border-0 border-b border-gray-200 focus:border-primary-500 focus:ring-0 bg-transparent py-1 text-gray-600"
                                                        />
                                                    </td>
                                                    {/* Debe $ */}
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number" step="0.01" min="0"
                                                            value={line.debit || ''}
                                                            onChange={e => handleLineChange(line.id, 'debit', e.target.value)}
                                                            className="w-full text-right text-sm border-0 border-b border-gray-200 focus:border-primary-500 focus:ring-0 bg-transparent py-1 text-green-700 font-mono"
                                                        />
                                                    </td>
                                                    {/* Haber $ */}
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number" step="0.01" min="0"
                                                            value={line.credit || ''}
                                                            onChange={e => handleLineChange(line.id, 'credit', e.target.value)}
                                                            className="w-full text-right text-sm border-0 border-b border-gray-200 focus:border-primary-500 focus:ring-0 bg-transparent py-1 text-red-700 font-mono"
                                                        />
                                                    </td>
                                                    {/* Debe Bs */}
                                                    <td className="px-3 py-2 bg-blue-50/40">
                                                        <input
                                                            type="number" step="0.01" min="0"
                                                            value={line.debit_ves || ''}
                                                            onChange={e => handleLineChange(line.id, 'debit_ves', e.target.value)}
                                                            className="w-full text-right text-sm border-0 border-b border-blue-200 focus:border-blue-500 focus:ring-0 bg-transparent py-1 text-green-700 font-mono"
                                                        />
                                                    </td>
                                                    {/* Haber Bs */}
                                                    <td className="px-3 py-2 bg-blue-50/40">
                                                        <input
                                                            type="number" step="0.01" min="0"
                                                            value={line.credit_ves || ''}
                                                            onChange={e => handleLineChange(line.id, 'credit_ves', e.target.value)}
                                                            className="w-full text-right text-sm border-0 border-b border-blue-200 focus:border-blue-500 focus:ring-0 bg-transparent py-1 text-red-700 font-mono"
                                                        />
                                                    </td>
                                                    {/* Eliminar */}
                                                    <td className="px-2 py-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveLine(line.id)}
                                                            disabled={lines.length <= 2}
                                                            className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-0"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {/* Totales */}
                                    <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-sm font-bold font-mono">
                                        <tr>
                                            <td className="px-4 py-3" colSpan={2}>
                                                <button
                                                    type="button"
                                                    onClick={handleAddLine}
                                                    disabled={loadingAccounts || movementAccounts.length === 0}
                                                    className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 font-medium text-sm disabled:opacity-40"
                                                >
                                                    <PlusIcon className="w-4 h-4" /> Agregar línea
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-right text-green-700">$ {totalDebitUSD.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right text-red-700">$ {totalCreditUSD.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right text-green-700 bg-blue-50">Bs {totalDebitVES.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right text-red-700 bg-blue-50">Bs {totalCreditVES.toFixed(2)}</td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Semáforo de balance */}
                        <div className={`flex items-center justify-between p-4 rounded-xl border text-sm transition-colors ${
                            isBalanced
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : totalDebitUSD === 0
                                ? 'bg-gray-50 border-gray-200 text-gray-500'
                                : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                            <div className="flex items-center gap-3">
                                <span className="relative flex h-3 w-3 shrink-0">
                                    {!isBalanced && totalDebitUSD > 0 && (
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                    )}
                                    <span className={`relative inline-flex rounded-full h-3 w-3 ${
                                        isBalanced ? 'bg-green-500' : totalDebitUSD === 0 ? 'bg-gray-300' : 'bg-red-500'
                                    }`} />
                                </span>
                                <span className="font-medium">
                                    {isBalanced
                                        ? '✓ Partida doble balanceada — listo para guardar'
                                        : totalDebitUSD === 0
                                        ? 'Ingresa los montos para verificar el balance'
                                        : '✗ El asiento no cuadra (Debe ≠ Haber)'}
                                </span>
                            </div>
                            {!isBalanced && totalDebitUSD > 0 && (
                                <div className="flex gap-4 font-mono text-xs">
                                    <span>Diff $: {diffUSD.toFixed(2)}</span>
                                    <span>Diff Bs: {diffVES.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        {submitError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
                                {submitError}
                            </div>
                        )}
                    </div>
                </form>

                {/* ── Footer ────────────────────────────────────────────────── */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        form="manual-entry-form"
                        type="submit"
                        disabled={!isBalanced || isSubmitting || loadingAccounts}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-primary-600 rounded-xl shadow hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        {isSubmitting ? 'Guardando asiento...' : 'Asentar en Diario'}
                    </button>
                </div>
            </div>
        </div>
    )
}