'use client'

import { useEffect, useState, useCallback } from 'react'
import { getAccountingData, getActiveAccounts, syncAccountingRecords } from '@/app/actions/accounting'
import { JournalEntryFlat } from '@/types/database'
import JournalTable from '@/components/libro-digital/JournalTable'
import LedgerTable from '@/components/libro-digital/LedgerTable'
import TrialBalance from '@/components/libro-digital/TrialBalance'
import ManualEntryModal from '@/components/libro-digital/ManualEntryModal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline'

export default function LibroDigitalPage() {
    const [entries, setEntries] = useState<JournalEntryFlat[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [dataError, setDataError] = useState<string | null>(null)
    const router = useRouter()

    // ─── Carga de datos — una sola definición ─────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true)
        setDataError(null)
        try {
            const [accRes, entriesRes] = await Promise.all([
                getActiveAccounts(),
                getAccountingData(),
            ])

            if (accRes.success && accRes.data) {
                setAccounts(accRes.data)
            }

            if (entriesRes.success && entriesRes.data) {
                setEntries(entriesRes.data as JournalEntryFlat[])
            } else if (entriesRes.error) {
                setDataError(entriesRes.error)
            }
        } catch (err: any) {
            console.error('Error en loadData:', err)
            setDataError('Error de conexión al cargar el libro digital.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    // ─── Sincronización automática ────────────────────────────────────────────
    const handleSync = async () => {
        setSyncing(true)
        try {
            const res = await syncAccountingRecords()
            if (res.success) {
                toast.success(`Sincronización completa: ${res.syncedCount ?? 0} asientos generados.`)
                loadData()
            } else {
                toast.error('Error en sincronización: ' + res.error)
            }
        } catch {
            toast.error('Fallo en la sincronización')
        } finally {
            setSyncing(false)
        }
    }

    // ─── Modal handlers ───────────────────────────────────────────────────────
    const handleNewEntry = () => setIsModalOpen(true)

    const handleEntryCreated = () => {
        setIsModalOpen(false)
        loadData()
        router.refresh()
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">

            {/* ── CABECERA: SIEMPRE VISIBLE, sin depender de loading ni de entries ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Libro Digital</h1>
                    <p className="text-sm text-gray-500">Gestión contable bimonetaria y reportes en tiempo real</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm font-medium"
                    >
                        <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar'}
                    </button>
                    <button
                        onClick={handleNewEntry}
                        className="flex-1 md:flex-none bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Nuevo Asiento
                    </button>
                </div>
            </div>

            {/* ── ÁREA DE CONTENIDO ─────────────────────────────────────────────────── */}
            <div className="min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100">
                        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin mb-4" />
                        <p className="text-gray-500 font-medium">Cargando libro contable...</p>
                    </div>
                ) : dataError ? (
                    /* Error de organización / sesión — no rompe el componente */
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-amber-200">
                        <div className="text-4xl mb-3">⚠️</div>
                        <p className="text-amber-700 font-semibold text-lg mb-1">No se pudieron cargar los datos</p>
                        <p className="text-gray-500 text-sm max-w-md text-center">{dataError}</p>
                        <button
                            onClick={loadData}
                            className="mt-6 px-5 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
                        >
                            Reintentar
                        </button>
                    </div>
                ) : (
                    <Tabs defaultValue="diario" className="w-full">
                        <TabsList className="bg-gray-100 p-1 rounded-xl mb-6 flex overflow-x-auto">
                            <TabsTrigger value="diario" className="rounded-lg px-8 flex-1 sm:flex-none">Libro Diario</TabsTrigger>
                            <TabsTrigger value="mayor"  className="rounded-lg px-8 flex-1 sm:flex-none">Libro Mayor</TabsTrigger>
                            <TabsTrigger value="balance" className="rounded-lg px-8 flex-1 sm:flex-none">Balance Comprobación</TabsTrigger>
                        </TabsList>

                        <TabsContent value="diario" className="mt-0 focus-visible:ring-0">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-visible">
                                <JournalTable
                                    entries={entries}
                                    onNewEntry={handleNewEntry}
                                    organizationName="ETHOS"
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="mayor" className="mt-0 focus-visible:ring-0">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-visible">
                                <LedgerTable
                                    entries={entries}
                                    organizationName="ETHOS"
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="balance" className="mt-0 focus-visible:ring-0">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-visible">
                                <TrialBalance
                                    entries={entries}
                                    organizationName="ETHOS"
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                )}
            </div>

            {/* ── MODAL ASIENTO MANUAL ──────────────────────────────────────────────── */}
            <ManualEntryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleEntryCreated}
                accounts={accounts}
            />
        </div>
    )
}