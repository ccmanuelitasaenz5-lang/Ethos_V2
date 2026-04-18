import { createClient } from '@/lib/supabase/server'
import { unstable_cache } from 'next/cache'

export const getDashboardStats = async (organizationId: string) => {
    const supabase = await createClient()

    const { data: incomeData } = await supabase
      .from('transactions_income')
      .select('amount_usd, amount_ves, date')
      .eq('organization_id', organizationId)
    
    const { data: expenseData } = await supabase
      .from('transactions_expense')
      .select('amount_usd, amount_ves, date, category')
      .eq('organization_id', organizationId)

    const { data: bankAccounts } = await supabase
      .from('bank_accounts')
      .select('current_balance, currency')
      .eq('organization_id', organizationId)

    return {
      incomeData: incomeData || [],
      expenseData: expenseData || [],
      bankAccounts: bankAccounts || []
    }
}
