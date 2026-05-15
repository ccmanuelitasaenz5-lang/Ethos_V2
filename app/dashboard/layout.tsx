import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { getBCVRate } from '@/lib/exchange'
import { createAdminClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Get user's organization info
    let { data: userData } = await supabase
        .from('users')
        .select('organization_id, full_name')
        .eq('id', user.id)
        .maybeSingle()

    // --- REPAIR IDENTITY / SYNC METADATA ---
    // Critical: RLS policies depend on organization_id being in the JWT metadata.
    if (userData?.organization_id && user.user_metadata?.organization_id !== userData.organization_id) {
        const adminSupabase = createAdminClient();
        await adminSupabase.auth.admin.updateUserById(user.id, {
            user_metadata: { 
                ...user.user_metadata,
                organization_id: userData.organization_id 
            }
        });
    }

    let organization = null
    if (userData?.organization_id) {
        const { data } = await supabase
            .from('organizations')
            .select('name, rif')
            .eq('id', userData.organization_id)
            .maybeSingle()
        organization = data
    }

    const bcvRate = await getBCVRate()

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header
                    user={user}
                    fullName={userData?.full_name}
                    organizationName={organization?.name}
                    rif={organization?.rif}
                    bcvRate={bcvRate}
                />
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
