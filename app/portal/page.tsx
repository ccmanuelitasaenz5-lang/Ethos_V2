import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ResidentDashboard from '@/components/portal/ResidentDashboard'
 
export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
 
  if (!user) redirect('/login')
 
  // Verificar que sea residente
  const { data: profile } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()
 
  if (profile?.role !== 'resident') {
    redirect('/dashboard')
  }
 
  // Obtener resumen de cuenta
  const { data: summary } = await supabase
    .from('resident_account_summary')
    .select('*')
    .eq('resident_user_id', user.id)
    .maybeSingle()

  // Obtener últimos pagos: transactions_income NO tiene resident_user_id.
  // El vínculo real es transactions_income.property_id -> properties.resident_user_id
  // (ver migración 017_resident_portal.sql). Filtrar por una columna inexistente
  // rompía el portal con un error de base de datos para todo residente.
  let payments: any[] = []
  if (summary?.property_id) {
    const { data } = await supabase
      .from('transactions_income')
      .select('*')
      .eq('property_id', summary.property_id)
      .order('date', { ascending: false })
      .limit(5)
    payments = data || []
  }
 
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Portal del Residente</h1>
        <p className="text-gray-500">Bienvenido a su estado de cuenta personal</p>
      </header>
 
      <ResidentDashboard summary={summary} lastPayments={payments || []} />
    </div>
  )
}
