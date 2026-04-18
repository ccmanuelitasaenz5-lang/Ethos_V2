'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { incomeSchema, IncomeFormValues } from '@/lib/validations/income'
import { createIncome, updateIncome } from '@/app/actions/income'
import { toast } from 'react-hot-toast'

import { TransactionIncome, TransactionAccount, Property } from '@/types/database'

interface IncomeFormProps {
    initialRate?: number
    accounts?: TransactionAccount[]
    properties?: Property[]
    initialData?: TransactionIncome
}

export default function IncomeForm({ initialRate, accounts = [], properties = [], initialData }: IncomeFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState<'draft' | 'finalized'>(initialData?.status === 'finalized' ? 'finalized' : 'draft')

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors }
    } = useForm<IncomeFormValues>({
        resolver: zodResolver(incomeSchema),
        defaultValues: {
            date: initialData?.date || new Date().toISOString().split('T')[0],
            receipt_number: initialData?.receipt_number || '',
            control_number: initialData?.control_number || '',
            concept: initialData?.concept || '',
            amount_usd: initialData?.amount_usd || 0,
            exchange_rate: initialData?.exchange_rate || initialRate || 0,
            payment_method: initialData?.payment_method || 'transferencia',
            status: initialData?.status || 'draft',
            property_id: initialData?.property_id || undefined,
            account_code: initialData?.account_code || '',
            bank_account: initialData?.bank_account || '',
        }
    })

    const amountUSD = watch('amount_usd')
    const exchangeRate = watch('exchange_rate')

    // Derived value for VES (read-only in this version for simplicity, or we can add sync)
    const amountVES = (amountUSD || 0) * (exchangeRate || 0)

    async function onSubmit(data: IncomeFormValues) {
        setLoading(true)
        
        const formData = new FormData()
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, value.toString())
            }
        })
        
        // Ensure the correct status is sent based on which button was clicked
        formData.set('status', status)

        try {
            const result = initialData?.id
                ? await updateIncome(initialData.id, formData)
                : await createIncome(formData)

            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success(initialData?.id ? 'Ingreso actualizado' : 'Ingreso creado')
                router.push('/dashboard/ingresos')
                router.refresh()
            }
        } catch (e) {
            toast.error('Error al procesar la solicitud')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Fecha *</label>
                    <input
                        type="date"
                        {...register('date')}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    />
                    {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Inmueble / Unidad</label>
                    <select
                        {...register('property_id')}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    >
                        <option value="">Seleccionar...</option>
                        {properties.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.number} {p.owner_name ? `- ${p.owner_name}` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Número de Recibo</label>
                    <input
                        type="text"
                        {...register('receipt_number')}
                        placeholder="REC-001"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Número de Control (Fiscal)</label>
                    <input
                        type="text"
                        {...register('control_number')}
                        placeholder="00-000000"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    />
                </div>

                <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Concepto *</label>
                    <input
                        type="text"
                        {...register('concept')}
                        placeholder="Pago de condominio"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    />
                    {errors.concept && <p className="mt-1 text-xs text-red-600">{errors.concept.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Cuenta de Ingreso *</label>
                    <select
                        {...register('account_code')}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    >
                        <option value="">Seleccionar cuenta...</option>
                        {accounts
                            .filter(a => a.main_type === 'INCOME' && a.is_movement)
                            .map(a => (
                                <option key={a.id} value={a.code}>
                                    {a.code} - {a.name}
                                </option>
                            ))
                        }
                    </select>
                    {errors.account_code && <p className="mt-1 text-xs text-red-600">{errors.account_code.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Cuenta de Destino *</label>
                    <select
                        {...register('bank_account')}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    >
                        <option value="">Seleccionar banco/caja...</option>
                        {accounts
                            .filter(a => a.main_type === 'ASSET' && a.is_movement && (a.code.startsWith('1.1') || a.name.toLowerCase().includes('banco') || a.name.toLowerCase().includes('caja')))
                            .map(a => (
                                <option key={a.id} value={a.code}>
                                    {a.code} - {a.name}
                                </option>
                            ))
                        }
                    </select>
                    {errors.bank_account && <p className="mt-1 text-xs text-red-600">{errors.bank_account.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Monto USD *</label>
                    <div className="mt-1 relative rounded-lg shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            {...register('amount_usd')}
                            className="block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                            placeholder="0.00"
                        />
                    </div>
                    {errors.amount_usd && <p className="mt-1 text-xs text-red-600">{errors.amount_usd.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Equivalente en Bolívares (VES)</label>
                    <div className="mt-1 relative rounded-lg shadow-sm bg-gray-50">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-400 sm:text-sm">Bs.</span>
                        </div>
                        <input
                            type="text"
                            value={amountVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            readOnly
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Tasa BCV Aplicada *</label>
                    <input
                        type="number"
                        step="0.0001"
                        {...register('exchange_rate')}
                        className="mt-1 block w-full px-3 py-2 border border-blue-200 bg-blue-50 text-blue-900 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 font-bold"
                    />
                    {errors.exchange_rate && <p className="mt-1 text-xs text-red-600">{errors.exchange_rate.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Método de Pago *</label>
                    <select
                        {...register('payment_method')}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    >
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="pago_movil">Pago Móvil</option>
                        <option value="cheque">Cheque</option>
                        <option value="tarjeta">Tarjeta</option>
                    </select>
                    {errors.payment_method && <p className="mt-1 text-xs text-red-600">{errors.payment_method.message}</p>}
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    onClick={() => setStatus('draft')}
                    className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                >
                    {loading && status === 'draft' ? 'Procesando...' : 'Guardar Borrador'}
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    onClick={() => setStatus('finalized')}
                    className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                    {loading && status === 'finalized' ? 'Procesando...' : 'Finalizar y Fiscalizar'}
                </button>
            </div>
        </form>
    )
}
