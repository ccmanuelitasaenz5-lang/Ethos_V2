import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlusIcon } from '@heroicons/react/24/outline'
import IncomeTable from '@/components/ingresos/IncomeTable'
import { TransactionIncome } from '@/types/database'

export default async function IngresosPage({
    searchParams
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

    const organizationId = userData?.organization_id
    if (!organizationId) return null

    // Get filter from searchParams
    const status = (searchParams.status as string) || 'all'

    // Query builder
    let query = supabase
        .from('active_income')
        .select('id, date, receipt_number, control_number, concept, amount_usd, amount_ves, exchange_rate, status, payment_method, organization_id, property_id, account_code, bank_account')
        .eq('organization_id', organizationId)
        .order('date', { ascending: false })

    if (status !== 'all') {
        query = query.eq('status', status)
    }

    const { data: incomesData } = await query
    const incomes = (incomesData as unknown as TransactionIncome[]) || []

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Ingresos</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Gestión de recibos y entradas de dinero
                    </p>
                </div>
                <div className="flex items-center space-x-4">
                    {/* Status Filter */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <Link
                            href="/dashboard/ingresos?status=all"
                            className={`px-3 py-1 text-xs font-medium rounded-md ${status === 'all' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Todos
                        </Link>
                        <Link
                            href="/dashboard/ingresos?status=draft"
                            className={`px-3 py-1 text-xs font-medium rounded-md ${status === 'draft' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Borradores
                        </Link>
                        <Link
                            href="/dashboard/ingresos?status=finalized"
                            className={`px-3 py-1 text-xs font-medium rounded-md ${status === 'finalized' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Finalizados
                        </Link>
                    </div>

                    <Link
                        href="/dashboard/ingresos/nuevo"
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                    >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Nuevo Ingreso
                    </Link>
                </div>
            </div>

            <IncomeTable 
                incomes={incomes} 
                organizationId={organizationId}
            />
        </div>
    )
}
