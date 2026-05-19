'use client'

import { useState } from 'react'
import { TransactionIncome, TransactionExpense } from '@/types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { generateISLRXml } from '@/lib/export/seniat'

interface FiscalReportsProps {
    incomes: TransactionIncome[]
    expenses: TransactionExpense[]
    organization: { name: string, rif?: string | null }
}

export default function FiscalReports({ incomes, expenses, organization }: FiscalReportsProps) {
    const [activeTab, setActiveTab] = useState<'sales' | 'purchases' | 'islr'>('sales')
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM

    // Filter by selected month
    const monthlyIncomes = incomes.filter(i => i.date.startsWith(selectedMonth))
    const monthlyExpenses = expenses.filter(e => e.date.startsWith(selectedMonth))

    return (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden mt-8">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-800">Libros Fiscales (SENIAT)</h2>
                <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="border-gray-300 rounded-lg text-sm"
                />
            </div>

            <div className="border-b border-gray-100">
                <nav className="flex -mb-px">
                    <button
                        onClick={() => setActiveTab('sales')}
                        className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'sales'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Libro de Ventas (IVA)
                    </button>
                    <button
                        onClick={() => setActiveTab('purchases')}
                        className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'purchases'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Libro de Compras (IVA)
                    </button>
                    <button
                        onClick={() => setActiveTab('islr')}
                        className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'islr'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Retenciones ISLR
                    </button>
                </nav>
            </div>

            <div className="p-6 overflow-x-auto">
                {activeTab === 'sales' && (
                    <SalesBookTable incomes={monthlyIncomes} />
                )}
                {activeTab === 'purchases' && (
                    <PurchasesBookTable expenses={monthlyExpenses} />
                )}
                {activeTab === 'islr' && (
                    <ISLRTable expenses={monthlyExpenses} rifAgent={organization.rif || ''} period={selectedMonth.replace('-', '')} />
                )}
            </div>
        </div>
    )
}

function SalesBookTable({ incomes }: { incomes: TransactionIncome[] }) {
    return (
        <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-2 py-2">Fecha</th>
                    <th className="px-2 py-2">RIF / CI</th>
                    <th className="px-2 py-2">Nombre / Razón Social</th>
                    <th className="px-2 py-2">N° Factura</th>
                    <th className="px-2 py-2">N° Control</th>
                    <th className="px-2 py-2">Total Ventas</th>
                    <th className="px-2 py-2">Base Imponible</th>
                    <th className="px-2 py-2">IVA (16%)</th>
                    <th className="px-2 py-2">IGTF Percibido</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-center">
                {incomes.length === 0 ? (
                    <tr><td colSpan={9} className="py-4 text-gray-500">No hay movimientos en este periodo</td></tr>
                ) : incomes.map(income => (
                    <tr key={income.id}>
                        <td className="px-2 py-2">{format(new Date(income.date + 'T12:00:00'), 'dd/MM/yyyy')}</td>
                        <td className="px-2 py-2">-</td>
                        <td className="px-2 py-2">{income.concept}</td>
                        <td className="px-2 py-2">{income.receipt_number || '-'}</td>
                        <td className="px-2 py-2">{income.control_number || '-'}</td>
                        <td className="px-2 py-2">{((income.amount_ves || 0)).toFixed(2)}</td>
                        <td className="px-2 py-2">{((income.amount_ves || 0) / 1.16).toFixed(2)}</td>
                        <td className="px-2 py-2">{((income.amount_ves || 0) - ((income.amount_ves || 0) / 1.16)).toFixed(2)}</td>
                        <td className="px-2 py-2">0.00</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

function PurchasesBookTable({ expenses }: { expenses: TransactionExpense[] }) {
    return (
        <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-2 py-2">Fecha</th>
                    <th className="px-2 py-2">RIF</th>
                    <th className="px-2 py-2">Proveedor</th>
                    <th className="px-2 py-2">N° Factura</th>
                    <th className="px-2 py-2">N° Control</th>
                    <th className="px-2 py-2">Total Compras</th>
                    <th className="px-2 py-2">Base Imponible</th>
                    <th className="px-2 py-2">IVA</th>
                    <th className="px-2 py-2">Ret. IVA</th>
                    <th className="px-2 py-2">IGTF Pagado</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-center">
                {expenses.length === 0 ? (
                    <tr><td colSpan={10} className="py-4 text-gray-500">No hay movimientos en este periodo</td></tr>
                ) : expenses.map(expense => (
                    <tr key={expense.id}>
                        <td className="px-2 py-2">{format(new Date(expense.date + 'T12:00:00'), 'dd/MM/yyyy')}</td>
                        <td className="px-2 py-2">-</td>
                        <td className="px-2 py-2">{expense.supplier}</td>
                        <td className="px-2 py-2">{expense.invoice_number || '-'}</td>
                        <td className="px-2 py-2">{expense.control_number || '-'}</td>
                        <td className="px-2 py-2">{((expense.amount_ves || 0)).toFixed(2)}</td>
                        <td className="px-2 py-2">{(expense.subtotal || 0).toFixed(2)}</td>
                        <td className="px-2 py-2">{(expense.iva_amount || 0).toFixed(2)}</td>
                        <td className="px-2 py-2">{(expense.retention_iva || 0).toFixed(2)}</td>
                        <td className="px-2 py-2">{(expense.igtf_amount || 0).toFixed(2)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

function ISLRTable({ expenses, rifAgent, period }: { expenses: TransactionExpense[], rifAgent: string, period: string }) {
    const expensesWithRetention = expenses.filter(e => (e.retention_islr || 0) > 0)

    const handleDownload = () => {
        if (!rifAgent) {
            alert('Error: La organización no tiene RIF configurado.')
            return
        }
        const xmlContent = generateISLRXml(expensesWithRetention, rifAgent, period)

        const blob = new Blob([xmlContent], { type: 'application/xml' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ISLR_${rifAgent}_${period}.xml`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }

    return (
        <div>
            <div className="mb-4 flex justify-end">
                <button
                    onClick={handleDownload}
                    className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                    Descargar XML (SENIAT)
                </button>
            </div>
            <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-2 py-2">Fecha</th>
                        <th className="px-2 py-2">Proveedor</th>
                        <th className="px-2 py-2">Concepto</th>
                        <th className="px-2 py-2">Base Imponible</th>
                        <th className="px-2 py-2">% Ret</th>
                        <th className="px-2 py-2">Monto Retenido</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-center">
                    {expensesWithRetention.length === 0 ? (
                        <tr><td colSpan={6} className="py-4 text-gray-500">No hay retenciones de ISLR</td></tr>
                    ) : expensesWithRetention.map(expense => (
                        <tr key={expense.id}>
                            <td className="px-2 py-2">{format(new Date(expense.date + 'T12:00:00'), 'dd/MM/yyyy')}</td>
                            <td className="px-2 py-2">{expense.supplier}</td>
                            <td className="px-2 py-2">{expense.concept}</td>
                            <td className="px-2 py-2">{(expense.subtotal || 0).toFixed(2)}</td>
                            <td className="px-2 py-2">-</td>
                            <td className="px-2 py-2">{(expense.retention_islr || 0).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
