'use client'

import { TransactionExpense } from '@/types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrashIcon, ArrowDownTrayIcon, PrinterIcon, PencilIcon } from '@heroicons/react/24/outline'
import { deleteExpense } from '@/app/actions/expense'
import { exportExpenseToExcel } from '@/lib/export/excel'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PrintHeader from '@/components/layout/PrintHeader'
import Pagination from '@/components/shared/Pagination'
import EmptyState from '@/components/shared/EmptyState'
import { toast } from 'react-hot-toast'
import { getTotalPages } from '@/lib/pagination'

interface ExpenseTableProps {
    expenses: TransactionExpense[]
    organizationName?: string
    totalItems: number
    currentPage: number
    itemsPerPage: number
}

export default function ExpenseTable({
    expenses,
    organizationName = 'Organización',
    totalItems,
    currentPage,
    itemsPerPage
}: ExpenseTableProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [deleting, setDeleting] = useState<string | null>(null)
    const [filterCategory, setFilterCategory] = useState<string>('all')
    const [minAmount, setMinAmount] = useState<string>('')

    const totalPages = getTotalPages(totalItems, itemsPerPage)

    async function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de eliminar este gasto?')) return

        setDeleting(id)
        const result = await deleteExpense(id)
        setDeleting(null)

        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success('Gasto eliminado correctamente')
            router.refresh()
        }
    }

    function handlePageChange(page: number) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', page.toString())
        router.push(`/dashboard/gastos?${params.toString()}`)
    }

    const filteredExpenses = expenses.filter(expense => {
        const matchesCat = filterCategory === 'all' || expense.category === filterCategory
        const matchesAmount = minAmount === '' || (expense.amount_usd || 0) >= parseFloat(minAmount)
        return matchesCat && matchesAmount
    })

    function handleExport() {
        exportExpenseToExcel(filteredExpenses, organizationName)
    }

    function handlePrint() {
        window.print()
    }

    const categories = Array.from(new Set(expenses.map(e => e.category).filter(Boolean)))

    return (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <PrintHeader title="Reporte de Gastos" organizationName={organizationName} />
            <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 no-print bg-gray-50/50">
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="text-xs border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white"
                    >
                        <option value="all">Todas las categorías</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat!}>{cat}</option>
                        ))}
                    </select>
                    <input
                        type="number"
                        placeholder="Monto min $"
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                        className="text-xs border-gray-300 rounded-lg w-24 focus:ring-primary-500 focus:border-primary-500 bg-white"
                    />
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        {filteredExpenses.length} resultados
                    </span>
                </div>

                <div className="flex space-x-2">
                    <button
                        onClick={handlePrint}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        <PrinterIcon className="h-4 w-4 mr-2 text-gray-500" />
                        PDF
                    </button>
                    <button
                        onClick={handleExport}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                        Excel
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Fecha
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Factura #
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                N° Control
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Proveedor
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Concepto
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Subtotal
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                IVA
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total USD
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total VES
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Fiscal
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Estatus
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {expenses.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="px-6 py-8">
                                    <EmptyState
                                        title="No hay gastos registrados"
                                        message="Comienza agregando tu primer gasto usando el botón 'Nuevo Gasto'"
                                    />
                                </td>
                            </tr>
                        ) : (
                            expenses.map((expense) => (
                                <tr key={expense.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {format(new Date(expense.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {expense.invoice_number || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {expense.control_number || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        {expense.supplier}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        {expense.concept}
                                        {expense.category && (
                                            <span className="block text-xs text-gray-500">
                                                {expense.category}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        ${expense.subtotal?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        ${expense.iva_amount?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        <span className="block text-xs text-gray-500">
                                            ({expense.iva_percentage}%)
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                                        ${expense.amount_usd?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                                        {expense.amount_ves
                                            ? `Bs. ${expense.amount_ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                            : '-'
                                        }
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 space-x-1">
                                        {expense.igtf_apply && <span className="px-1 py-0.5 bg-yellow-100 text-yellow-800 rounded">IGTF</span>}
                                        {(expense.retention_iva || 0) > 0 && <span className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded">R.IVA</span>}
                                        {(expense.retention_islr || 0) > 0 && <span className="px-1 py-0.5 bg-purple-100 text-purple-800 rounded">R.ISLR</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${expense.status === 'finalized' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {expense.status === 'finalized' ? 'Finalizado' : 'Borrador'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleDelete(expense.id)}
                                            disabled={deleting === expense.id}
                                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                            title="Eliminar"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                        {expense.status !== 'finalized' && (
                                            <button
                                                onClick={() => router.push(`/dashboard/gastos/editar/${expense.id}`)}
                                                className="text-primary-600 hover:text-primary-900 ml-3"
                                                title="Editar"
                                            >
                                                <PencilIcon className="h-5 w-5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {
                totalPages > 1 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={handlePageChange}
                    />
                )
            }
        </div >
    )
}
