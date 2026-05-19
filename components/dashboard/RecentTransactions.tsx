import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface RecentTransactionsProps {
    organizationId: string
}

export default async function RecentTransactions({ organizationId }: RecentTransactionsProps) {
    const supabase = await createClient()

    // Get recent income
    const { data: recentIncome } = await supabase
        .from('transactions_income')
        .select('id, date, concept, amount_usd, receipt_number')
        .eq('organization_id', organizationId)
        .order('date', { ascending: false })
        .limit(5)

    // Get recent expenses
    const { data: recentExpenses } = await supabase
        .from('transactions_expense')
        .select('id, date, concept, amount_usd, invoice_number, supplier')
        .eq('organization_id', organizationId)
        .order('date', { ascending: false })
        .limit(5)

    const allTransactions = [
        ...(recentIncome?.map(t => ({ ...t, type: 'income' as const })) || []),
        ...(recentExpenses?.map(t => ({ ...t, type: 'expense' as const })) || []),
    ].sort((a, b) => new Date(b.date + 'T12:00:00').getTime() - new Date(a.date + 'T12:00:00').getTime()).slice(0, 10)

    return (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                    Transacciones Recientes
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Fecha
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Tipo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Concepto
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Monto (USD)
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {allTransactions.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                    No hay transacciones registradas
                                </td>
                            </tr>
                        ) : (
                            allTransactions.map((transaction) => (
                                <tr key={`${transaction.type}-${transaction.id}`} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {format(new Date(transaction.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${transaction.type === 'income'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}>
                                            {transaction.type === 'income' ? 'Ingreso' : 'Gasto'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        {transaction.concept}
                                        {transaction.type === 'expense' && 'supplier' in transaction && (
                                            <span className="block text-xs text-gray-500">
                                                {transaction.supplier}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                                            {transaction.type === 'income' ? '+' : '-'}
                                            ${transaction.amount_usd?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
