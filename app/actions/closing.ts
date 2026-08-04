'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getMonthlyClosings(year: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
    if (!userData?.organization_id) return []

    // Start and end of year
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const { data, error } = await supabase
        .from('monthly_closings')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .gte('period', startDate)
        .lte('period', endDate)
        .order('period', { ascending: false })

    if (error) {
        console.error('Error fetching monthly closings:', error)
        return []
    }

    return data
}

export async function createMonthlyClosing(period: string, notes?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { data: userData } = await supabase
        .from('users')
        .select('organization_id, role')
        .eq('id', user.id)
        .single()

    if (!userData?.organization_id) return { error: 'Sin organización' }
    if (userData.role !== 'admin') return { error: 'Se requieren permisos de administrador' }

    // Ensure period is first day of month
    const date = new Date(period)
    const periodDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]

    const { data: closingData, error } = await supabase.from('monthly_closings').insert({
        organization_id: userData.organization_id,
        period: periodDate,
        closed_by: user.id,
        status: 'closed',
        notes: notes || '',
        metadata: {} // Will be updated with PDF URLs after generation
    }).select('id').single()

    if (error) {
        if (error.code === '23505') { // Unique violation
            return { error: 'Este mes ya ha sido cerrado.' }
        }
        return { error: error.message }
    }

    revalidatePath('/dashboard/reportes/cierre-mensual')
    return { success: true, closingId: closingData.id, organizationId: userData.organization_id }
}

export async function reopenMonthlyClosing(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { data: userData } = await supabase
        .from('users')
        .select('organization_id, role')
        .eq('id', user.id)
        .single()

    if (!userData?.organization_id) return { error: 'Sin organización' }
    if (userData.role !== 'admin') return { error: 'Se requieren permisos de administrador' }

    const { error } = await supabase
        .from('monthly_closings')
        .update({ status: 'reopened' })
        .eq('id', id)
        .eq('organization_id', userData.organization_id)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/reportes/cierre-mensual')
    return { success: true }
}

export async function checkPendingReconciliation(period: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
    if (!userData?.organization_id) return { error: 'Sin organización' }

    const date = new Date(period)
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]

    // Count unreconciled bank transactions
    const { count, error } = await supabase
        .from('bank_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', userData.organization_id)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('is_reconciled', false)

    if (error) return { error: error.message }

    return { count: count || 0 }
}

export async function checkAccountingBalance(period: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
    if (!userData?.organization_id) return { error: 'Sin organización' }

    const date = new Date(period)
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]

    // Sum debits and credits
    const { data, error } = await supabase
        .from('journal_entries')
        .select('debit, credit')
        .eq('organization_id', userData.organization_id)
        .gte('date', startDate)
        .lte('date', endDate)

    if (error) return { error: error.message }

    let totalDebit = 0
    let totalCredit = 0

    data?.forEach(entry => {
        totalDebit += Number(entry.debit || 0)
        totalCredit += Number(entry.credit || 0)
    })

    // Using a small epsilon for float comparison
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

    return {
        isBalanced,
        totalDebit,
        totalCredit,
        difference: totalDebit - totalCredit
    }
}

export async function savePDFToClosing(
    closingId: string,
    organizationId: string,
    period: string,
    reportType: 'journal' | 'ledger' | 'expense' | 'property-statement',
    pdfBase64: string
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    try {
        // Convert base64 to Blob
        const byteCharacters = atob(pdfBase64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const pdfBlob = new Blob([byteArray], { type: 'application/pdf' })

        // Generate filename
        const timestamp = Date.now()
        const fileName = `${reportType}_${period}_${timestamp}.pdf`
        const filePath = `closings/${organizationId}/${period}/${fileName}`

        // Upload to Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, pdfBlob, {
                contentType: 'application/pdf',
                cacheControl: '3600',
                upsert: false
            })

        if (uploadError) {
            console.error('Error uploading PDF:', uploadError)
            return { error: uploadError.message }
        }

        // Record in database
        const { error: dbError } = await supabase
            .from('generated_reports')
            .insert({
                closing_id: closingId,
                organization_id: organizationId,
                report_type: reportType,
                file_path: uploadData.path,
                file_name: fileName,
                file_size: pdfBlob.size,
                generated_by: user.id,
                metadata: {
                    period,
                    generatedAt: new Date().toISOString()
                }
            })

        if (dbError) {
            console.error('Error saving to database:', dbError)
            // Clean up uploaded file
            await supabase.storage.from('documents').remove([filePath])
            return { error: dbError.message }
        }

        return { success: true, filePath: uploadData.path }
    } catch (error: any) {
        console.error('Error in savePDFToClosing:', error)
        return { error: error.message }
    }
}

export async function getClosingReports(closingId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('generated_reports')
        .select('*')
        .eq('closing_id', closingId)
        .order('report_type')

    if (error) {
        console.error('Error fetching reports:', error)
        return []
    }

    // El bucket 'documents' es PRIVADO (ver migración 020_documents_private_storage.sql),
    // por lo que getPublicUrl() nunca funcionaba: generaba una URL que devolvía
    // 400/403 al intentar descargarla. Se usa una URL firmada con expiración corta.
    const reportsWithUrls = await Promise.all(
        (data || []).map(async (report) => {
            const { data: signedUrlData } = await supabase.storage
                .from('documents')
                .createSignedUrl(report.file_path, 60 * 10) // 10 minutos

            return {
                ...report,
                publicUrl: signedUrlData?.signedUrl || null
            }
        })
    )

    return reportsWithUrls
}
