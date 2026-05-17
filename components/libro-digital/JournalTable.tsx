'use client'

import { JournalEntryFlat } from '@/types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useState, useMemo, Fragment } from 'react'
import * as XLSX from 'xlsx'
import { ArrowDownTrayIcon, MagnifyingGlassIcon, PrinterIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import PrintHeader from '@/components/layout/PrintHeader'

interface JournalTableProps {
    entries: JournalEntryFlat[]
    organizationName?: string
    onNewEntry?: () => void
}

export default function JournalTable({ entries, organizationName = 'Organización', onNewEntry }: JournalTableProps) {
    const [searchTerm, setSearchTerm] = useState('')

    // 1. Agrupar entradas por número de asiento
    const groupedEntries = useMemo(() => {
        const groups: Record<number, JournalEntryFlat[]> = {}
        entries.forEach(entry => {
            const num = entry.entry_number || 0
            if (!groups[num]) groups[num] = []
            groups[num].push(entry)
        })
        return Object.entries(groups).sort((a, b) => Number(b[0]) - Number(a[0])) // Descendente
    }, [entries])

    const filteredGroups = groupedEntries.filter(([num, items]) => 
        items.some(item => 
            item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.account_name.toLowerCase().includes(searchTerm.toLowerCase())
        )
    )

    function handleExport() {
        // Garantizar tipos numéricos para Excel
        const data = entries.map(entry => ({
            'Asiento': entry.entry_number,
            'Fecha': format(new Date(entry.date), 'dd/MM/yyyy'),
            'Código': entry.account_code,
            'Cuenta': entry.account_name,
            'Descripción': entry.description,
            'Debe ($)': { v: entry.debit, t: 'n' },
            'Haber ($)': { v: entry.credit, t: 'n' },
            'Debe (Bs)': { v: entry.debit_ves || 0, t: 'n' },
            'Haber (Bs)': { v: entry.credit_ves || 0, t: 'n' },
        }))

        const ws = XLSX.utils.json_to_sheet(data, { skipHeader: false })
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Libro Diario')
        XLSX.writeFile(wb, `Libro_Diario_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    }

    return (
        <div className="space-y-4">
            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white; padding: 0; }
                    .print-area { width: 100%; border: none !important; }
                    table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    th, td { border: 1px solid #eee !important; font-size: 10pt !important; }
                }
            `}</style>

            <PrintHeader title="Libro Diario" organizationName={organizationName} />
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <div className="relative w-full sm:w-64">
                    <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por código o cuenta..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    />
                </div>
                <div className="flex space-x-2 w-full sm:w-auto">
                    <button onClick={() => window.print()} className="flex-1 sm:flex-none inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50">
                        <PrinterIcon className="h-5 w-5 mr-2" /> Imprimir
                    </button>
                    <button onClick={handleExport} className="flex-1 sm:flex-none inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50">
                        <ArrowDownTrayIcon className="h-5 w-5 mr-2 text-green-600" /> Excel
                    </button>
                    <button 
                        onClick={onNewEntry} 
                        className="flex-1 sm:flex-none bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-primary-700 active:scale-95 transition-all"
                    >
                        + Nuevo Asiento
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto border border-gray-100 rounded-xl print-area">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 uppercase text-[10px] font-bold text-gray-500">
                        <tr>
                            <th className="px-4 py-3 text-left">Asiento / Fecha</th>
                            <th className="px-4 py-3 text-left">Cuenta</th>
                            <th className="px-4 py-3 text-left">Descripción</th>
                            <th className="px-4 py-3 text-right">Debe ($)</th>
                            <th className="px-4 py-3 text-right">Haber ($)</th>
                            <th className="px-4 py-3 text-right text-blue-800">Debe (Bs)</th>
                            <th className="px-4 py-3 text-right text-blue-800">Haber (Bs)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {filteredGroups.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No se encontraron registros</td></tr>
                        ) : (
                            filteredGroups.map(([entryNum, items]) => {
                                const totalD = items.reduce((s, i) => s + i.debit, 0)
                                const totalC = items.reduce((s, i) => s + i.credit, 0)
                                const isBalanced = Math.abs(totalD - totalC) < 0.01

                                return (
                                    <Fragment key={entryNum}>
                                        {/* Cabecera del Grupo de Asiento */}
                                        <tr className="bg-gray-50/50 font-bold border-t-2 border-gray-200">
                                            <td className="px-4 py-2 text-xs flex items-center gap-2">
                                                <span className="bg-gray-200 px-2 py-0.5 rounded">#{entryNum}</span>
                                                <span>{format(new Date(items[0].date), 'dd/MM/yyyy')}</span>
                                            </td>
                                            <td colSpan={2} className="px-4 py-2 text-xs text-gray-600 italic">
                                                {items[0].description}
                                            </td>
                                            <td colSpan={4} className="px-4 py-2 text-right">
                                                {isBalanced ? (
                                                    <span className="inline-flex items-center text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                                        <CheckCircleIcon className="h-3 w-3 mr-1" /> Cuadrado
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center text-[10px] text-red-700 bg-red-100 px-2 py-0.5 rounded-full animate-pulse font-bold">
                                                        <ExclamationTriangleIcon className="h-3 w-3 mr-1" /> Descuadrado
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                        {/* Items del Asiento */}
                                        {items.map((item, idx) => (
                                            <tr key={item.id} className="hover:bg-blue-50/20 text-sm">
                                                <td className="px-4 py-2 text-gray-400 text-[10px] pl-8">Item {idx + 1}</td>
                                                <td className="px-4 py-2">
                                                    <div className="font-medium text-blue-700">{item.account_code}</div>
                                                    <div className="text-[10px] text-gray-400 uppercase">{item.account_name}</div>
                                                </td>
                                                <td className="px-4 py-2 text-gray-500 max-w-xs truncate">{item.description}</td>
                                                <td className="px-4 py-2 text-right font-mono text-green-600">
                                                    {item.debit > 0 ? item.debit.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono text-red-600">
                                                    {item.credit > 0 ? item.credit.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono text-green-700 bg-blue-50/10">
                                                    {item.debit_ves > 0 ? item.debit_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono text-red-700 bg-blue-50/10">
                                                    {item.credit_ves > 0 ? item.credit_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </Fragment>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
