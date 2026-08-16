'use client'
 
import { useState, useEffect } from 'react'
import { createExpense, updateExpense } from '@/app/actions/expense'
import { useRouter } from 'next/navigation'
import { TransactionAccount } from '@/types/database'
import { calculateIGTF } from '@/lib/fiscal'
import { ExpenseFormValues } from '@/lib/validations/expense'
import { toast } from 'react-hot-toast'
 
interface ExpenseFormProps {
    initialRate?: number
    accounts?: TransactionAccount[]
    initialData?: any
}
 
export default function ExpenseForm({ initialRate, accounts = [], initialData }: ExpenseFormProps) {
    const router = useRouter()
    
    // Estado de errores
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ExpenseFormValues, string[]>>>({})
    const [globalError, setGlobalError] = useState<string | null>(null)
    const [loadingDraft, setLoadingDraft] = useState(false)
    const [loadingFinal, setLoadingFinal] = useState(false)
 
    // Amounts
    const [subtotalUSD, setSubtotalUSD] = useState(initialData?.subtotal?.toString() || '')
    const [subtotalVES, setSubtotalVES] = useState(initialData?.amount_ves?.toString() || '')
 
    // Rates & Tax
    const [ivaPercentage, setIvaPercentage] = useState(initialData?.iva_percentage?.toString() || '16')
    const [exchangeRate, setExchangeRate] = useState(initialData?.exchange_rate?.toString() || initialRate?.toString() || '')
 
    // Fiscal
    const [igtfApply, setIgtfApply] = useState(initialData?.igtf_apply || false)
    const [retentionIvaPercent, setRetentionIvaPercent] = useState('75')
    const [retentionIslrPercent, setRetentionIslrPercent] = useState(initialData?.retention_islr?.toString() || '0')
 
    // Calculation logic
    const calculateIVA = (baseUSD: number) => (baseUSD * (parseFloat(ivaPercentage) / 100))
    const totalUSD = subtotalUSD ? parseFloat(subtotalUSD) + calculateIVA(parseFloat(subtotalUSD)) : 0
    const ivaAmountUSD = subtotalUSD ? calculateIVA(parseFloat(subtotalUSD)) : 0
    const retIvaUSD = ivaAmountUSD * (parseFloat(retentionIvaPercent) / 100)
    const retIslrUSD = parseFloat(subtotalUSD || '0') * (parseFloat(retentionIslrPercent) / 100)
    const totalVES = exchangeRate && totalUSD ? totalUSD * parseFloat(exchangeRate) : 0
    const igtfAmountVES = calculateIGTF(totalVES, igtfApply)
 
    const handleUSDChange = (val: string) => {
        setSubtotalUSD(val)
        if (val && exchangeRate) setSubtotalVES((parseFloat(val) * parseFloat(exchangeRate)).toFixed(2))
        else if (!val) setSubtotalVES('')
    }
 
    const handleVESChange = (val: string) => {
        setSubtotalVES(val)
        if (val && exchangeRate && parseFloat(exchangeRate) > 0) setSubtotalUSD((parseFloat(val) / parseFloat(exchangeRate)).toFixed(2))
        else if (!val) setSubtotalUSD('')
    }
 
    const handleRateChange = (val: string) => {
        setExchangeRate(val)
        if (subtotalUSD && val) setSubtotalVES((parseFloat(subtotalUSD) * parseFloat(val)).toFixed(2))
    }
 
    async function handleSave(targetStatus: 'draft' | 'finalized') {
        const form = document.getElementById('expense-form') as HTMLFormElement
        if (!form) return
        
        const formData = new FormData(form)
        formData.set('status', targetStatus)
        formData.set('igtf_apply', igtfApply.toString())
        formData.set('retention_iva', retIvaUSD.toString())
        formData.set('retention_islr', retIslrUSD.toString())
 
        if (targetStatus === 'draft') setLoadingDraft(true)
        else setLoadingFinal(true)
 
        setFieldErrors({})
        setGlobalError(null)
 
        try {
            const result = initialData?.id
                ? await updateExpense(initialData.id, formData)
                : await createExpense(formData)
 
            if (result?.fieldErrors) {
                setFieldErrors(result.fieldErrors as any)
                toast.error('Errores en los datos. Revise los campos.')
            } else if (result?.error) {
                setGlobalError(result.error)
                toast.error(result.error)
            } else if (result?.success) {
                toast.success(targetStatus === 'finalized' ? 'Gasto finalizado' : 'Borrador guardado')
                router.push('/dashboard/gastos')
                router.refresh()
            }
        } catch (err) {
            console.error('Error:', err)
            toast.error('Ocurrió un error inesperado')
        } finally {
            setLoadingDraft(false)
            setLoadingFinal(false)
        }
    }
 
    function FieldError({ name }: { name: keyof ExpenseFormValues }) {
        const errs = fieldErrors[name]
        if (!errs?.length) return null
        return <p className="text-red-600 text-[10px] mt-1 font-bold italic">{errs[0]}</p>
    }
 
    return (
        <form id="expense-form" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Fecha</label>
                    <input type="date" name="date" defaultValue={initialData?.date || new Date().toISOString().split('T')[0]} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    <input type="hidden" name="iva_percentage" value={ivaPercentage} />
                    <FieldError name="date" />
                </div>
 
                <div>
                    <label className="block text-sm font-medium text-gray-700">Factura #</label>
                    <input type="text" name="invoice_number" defaultValue={initialData?.invoice_number || ''} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    <FieldError name="invoice_number" />
                </div>
 
                <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Proveedor</label>
                    <input type="text" name="supplier" defaultValue={initialData?.supplier || ''} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    <FieldError name="supplier" />
                </div>
 
                <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Concepto</label>
                    <input type="text" name="concept" defaultValue={initialData?.concept || ''} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    <FieldError name="concept" />
                </div>
 
                {/* Agregado account_code y payment_account */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">Cuenta Contable</label>
                    <select name="account_code" defaultValue={initialData?.account_code || ''} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900">
                        <option value="">Seleccionar...</option>
                        {accounts.map(a => <option key={a.id} value={a.code}>{a.code} - {a.name}</option>)}
                    </select>
                    <FieldError name="account_code" />
                </div>
 
                <div>
                    <label className="block text-sm font-medium text-gray-700">Cuenta de Pago</label>
                    <select name="payment_account" defaultValue={initialData?.payment_account || ''} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900">
                        <option value="">Seleccionar...</option>
                        {accounts.filter(a => a.code.startsWith('1.1')).map(a => <option key={a.id} value={a.code}>{a.code} - {a.name}</option>)}
                    </select>
                    <FieldError name="payment_account" />
                </div>
 
                <div>
                    <label className="block text-sm font-medium text-gray-700">Subtotal (USD)</label>
                    <input type="number" name="subtotal" step="0.01" value={subtotalUSD} onChange={(e) => handleUSDChange(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    <FieldError name="subtotal" />
                </div>
 
                <div>
                    <label className="block text-sm font-medium text-gray-700">Tasa BCV</label>
                    <input type="number" name="exchange_rate" step="0.0001" value={exchangeRate} onChange={(e) => handleRateChange(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-blue-200 bg-blue-50 text-blue-900 font-bold rounded-lg shadow-sm" />
                    <FieldError name="exchange_rate" />
                </div>
 
                <div>
                    <label className="block text-sm font-medium text-gray-700">Método de Pago</label>
                    <select name="payment_method" defaultValue={initialData?.payment_method || ''} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900">
                        <option value="">Seleccionar...</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="pago_movil">Pago Móvil</option>
                    </select>
                    <FieldError name="payment_method" />
                </div>
 
                <div className="flex items-center space-x-2 sm:col-span-2">
                    <input type="checkbox" checked={igtfApply} onChange={(e) => setIgtfApply(e.target.checked)} className="h-4 w-4" />
                    <label className="text-sm font-medium">Aplica IGTF (3%)</label>
                </div>
 
                <div className="bg-gray-50 border p-4 rounded-xl grid grid-cols-2 gap-4 sm:col-span-2">
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase">Resumen USD</p>
                        <p className="text-sm">Base: ${parseFloat(subtotalUSD || '0').toFixed(2)}</p>
                        <p className="text-lg font-black mt-2">Total: ${totalUSD.toFixed(2)}</p>
                    </div>
                    <div className="border-l pl-4">
                        <p className="text-xs font-bold text-gray-500 uppercase">Resumen VES</p>
                        <p className="text-sm">Base: Bs. {parseFloat(subtotalVES || '0').toFixed(2)}</p>
                        <p className="text-lg font-black text-primary-700 mt-2">Total: Bs. {(totalVES + igtfAmountVES).toFixed(2)}</p>
                    </div>
                </div>
            </div>
 
            {globalError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{globalError}</div>}
 
            <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded-lg">Cancelar</button>
                <button type="button" onClick={() => handleSave('draft')} disabled={loadingDraft || loadingFinal} className="px-6 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50">
                    {loadingDraft ? 'Guardando...' : 'Guardar Borrador'}
                </button>
                <button type="button" onClick={() => handleSave('finalized')} disabled={loadingDraft || loadingFinal} className="px-6 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">
                    {loadingFinal ? 'Finalizando...' : 'Finalizar Gasto'}
                </button>
            </div>
        </form>
    )
}
