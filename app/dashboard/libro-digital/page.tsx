'use client'

import { useEffect, useState, useCallback } from 'react'
import { getAccountingData, getActiveAccounts, syncAccountingRecords } from '@/app/actions/accounting'
import { JournalEntryFlat } from '@/types/database'
import JournalTable from '@/components/libro-digital/JournalTable'
import LedgerTable from '@/components/libro-digital/LedgerTable'
import TrialBalance from '@/components/libro-digital/TrialBalance'
import ManualEntryModal from '@/components/libro-digital/ManualEntryModal'
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
    const [activeTab, setActiveTab] = useState<'diario' | 'mayor' | 'balance'>('diario')
    const router = useRouter()

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

    const handleNewEntry = () => setIsModalOpen(true)

    const handleEntryCreated = () => {
        setIsModalOpen(false)
        loadData()
        router.refresh()
    }

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">

            {/* Cabecera */}
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

            {/* Contenido */}
            <div className="min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100">
                        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin mb-4" />
                        <p className="text-gray-500 font-medium">Cargando libro contable...</p>
                    </div>
                ) : dataError ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-amber-200">
                        <div className="text-4xl mb-3">⚠️</div>
                        <p className="text-amber-700 font-semibold text-lg mb-1">No se pudieron cargar los datos</p>
                        <p className="text-gray-500 text-sm max-w-md text-center">{dataError}</p>
                        <button onClick={loadData} className="mt-6 px-5 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors">
                            Reintentar
                        </button>
                    </div>
                ) : (
                    <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                        <div className="border-b border-gray-200 bg-gray-50/50">
                            <nav className="flex px-4 overflow-x-auto">
                                <TabButton
                                    active={activeTab === 'diario'}
                                    onClick={() => setActiveTab('diario')}
                                    label="Libro Diario"
                                    icon="📖"
                                />
                                <TabButton
                                    active={activeTab === 'mayor'}
                                    onClick={() => setActiveTab('mayor')}
                                    label="Libro Mayor"
                                    icon="📒"
                                />
                                <TabButton
                                    active={activeTab === 'balance'}
                                    onClick={() => setActiveTab('balance')}
                                    label="Balance de Comprobación"
                                    icon="⚖️"
                                />
                            </nav>
                        </div>

                        <div className="p-4 sm:p-8">
                            {activeTab === 'diario' && (
                                <JournalTable
                                    entries={entries}
                                    onNewEntry={handleNewEntry}
                                    organizationName="ETHOS"
                                />
                            )}
                            {activeTab === 'mayor' && (
                                <LedgerTable
                                    entries={entries}
                                    organizationName="ETHOS"
                                />
                            )}
                            {activeTab === 'balance' && (
                                <TrialBalance
                                    entries={entries}
                                    organizationName="ETHOS"
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>

            <ManualEntryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleEntryCreated}
                accounts={accounts}
            />
        </div>
    )
}

function TabButton({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: string }) {
    return (
        <button
            onClick={onClick}
            className={`
                px-6 py-4 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center gap-2 whitespace-nowrap
                ${active
                    ? 'border-primary-600 text-primary-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                }
            `}
        >
            <span className="text-lg">{icon}</span>
            {label}
        </button>
    )
}