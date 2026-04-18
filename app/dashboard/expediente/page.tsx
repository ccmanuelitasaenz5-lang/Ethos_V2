import { createClient } from '@/lib/supabase/server'
import DocumentList from '@/components/expediente/DocumentList'
import DocumentUploadForm from '@/components/expediente/DocumentUploadForm'

export default async function ExpedientePage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    // Obtener datos del usuario y su rol/organización
    const { data: userData } = await supabase
        .from('users')
        .select('organization_id, role')
        .eq('id', user?.id)
        .single()

    const organizationId = userData?.organization_id
    const userRole = (userData?.role || 'resident') as 'admin' | 'auditor' | 'resident'

    // Cálculos estadísticos (Summary Card)
    const { count: totalItems } = organizationId
        ? await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
        : { count: 0 }

    const { data: allDocs } = organizationId
        ? await supabase
            .from('documents')
            .select('file_size')
            .eq('organization_id', organizationId)
        : { data: [] }

    const totalSize = allDocs?.reduce((sum, doc) => sum + (doc.file_size || 0), 0) || 0
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Expediente Digital</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Gestión de documentos y archivos de la organización
                    </p>
                </div>
                {/* Botón de subida ahora es un formulario inline modal-like */}
                {userRole === 'admin' && (
                    <DocumentUploadForm />
                )}
            </div>

            {/* Tarjetas Informativas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
                    <p className="text-sm text-gray-500 font-medium">Total Documentos</p>
                    <p className="mt-2 text-3xl font-bold text-blue-600">{totalItems || 0}</p>
                </div>
                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
                    <p className="text-sm text-gray-500 font-medium">Espacio Utilizado</p>
                    <p className="mt-2 text-3xl font-bold text-indigo-600">{totalSizeMB} MB</p>
                </div>
                <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
                    <p className="text-sm text-gray-500 font-medium">Salud del Almacenamiento</p>
                    <div className="mt-4 w-full bg-gray-100 rounded-full h-2">
                        <div 
                            className="bg-blue-500 h-2 rounded-full transition-all" 
                            style={{ width: `${Math.min((parseFloat(totalSizeMB) / 1024) * 100, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-right">
                        {((parseFloat(totalSizeMB) / 1024) * 100).toFixed(1)}% de 1 GB
                    </p>
                </div>
            </div>

            {/* Listado interactivo (Componente de Cliente con auto-refresco de URLs) */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-1">
                <DocumentList userRole={userRole} />
            </div>
        </div>
    )
}
