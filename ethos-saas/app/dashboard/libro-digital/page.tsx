'use client'

import { useEffect, useState, useCallback } from 'react'
import { getAccountingData, getActiveAccounts } from '@/app/actions/accounting'
import { JournalEntryFlat } from '@/types/database'
import JournalTable from '@/components/libro-digital/JournalTable'
import LedgerTable from '@/components/libro-digital/LedgerTable'
import TrialBalance from '@/components/libro-digital/TrialBalance'
import ManualEntryModal from '@/components/libro-digital/ManualEntryModal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export default function LibroDigitalPage() {
    const [entries, setEntries] = useState<JournalEntryFlat[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const router = useRouter()

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [accRes, entriesRes] = await Promise.all([
                getActiveAccounts(),
                getAccountingData()
            ])

            if (accRes.success) setAccounts(accRes.data)
            if (entriesRes.success) {
                setEntries(entriesRes.data)
            } else {
                toast.error('Error al cargar diario: ' + entriesRes.error)
            }
        } catch (error) {
            console.error(error)
            toast.error('Error de conexión')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleNewEntry = () => {
        setIsModalOpen(true)
    }

    const handleEntryCreated = () => {
        setIsModalOpen(false)
        loadData()
        router.refresh()
    }

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Libro Digital</h1>
                    <p className="text-sm text-gray-500">Gestión contable bimonetaria y reportes en tiempo real</p>
                </div>
                <button 
                    onClick={handleNewEntry}
                    className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all active:scale-95 flex items-center gap-2"
                >
                    <span className="text-xl">+</span> Nuevo Asiento
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 animate-pulse">
                    <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500 font-medium">Cargando registros contables...</p>
                </div>
            ) : (
                <Tabs defaultValue="diario" className="w-full">
                    <TabsList className="bg-gray-100 p-1 rounded-xl mb-6">
                        <TabsTrigger value="diario" className="rounded-lg px-8">Libro Diario</TabsTrigger>
                        <TabsTrigger value="mayor" className="rounded-lg px-8">Libro Mayor</TabsTrigger>
                        <TabsTrigger value="balance" className="rounded-lg px-8">Balance Comprobación</TabsTrigger>
                    </TabsList>

                    <TabsContent value="diario" className="mt-0 focus-visible:ring-0">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <JournalTable 
                                entries={entries} 
                                onNewEntry={handleNewEntry}
                                organizationName="ETHOS"
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="mayor" className="mt-0 focus-visible:ring-0">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <LedgerTable entries={entries} onNewEntry={handleNewEntry} />
                        </div>
                    </TabsContent>

                    <TabsContent value="balance" className="mt-0 focus-visible:ring-0">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <TrialBalance entries={entries} onNewEntry={handleNewEntry} />
                        </div>
                    </TabsContent>
                </Tabs>
            )}

            <ManualEntryModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleEntryCreated}
                accounts={accounts}
            />
        </div>
    )
}