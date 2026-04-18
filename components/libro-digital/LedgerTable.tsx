'use client'

import { JournalEntryFlat } from '@/types/database'
import { useState } from 'react'

interface LedgerTableProps {
    entries: JournalEntryFlat[]
    onNewEntry?: () => void
}

export default function LedgerTable({ entries, onNewEntry }: LedgerTableProps) {
    // Aggregate by account code
    const accountsMap = entries.reduce((acc, entry) => {
        if (!acc[entry.account_code]) {
            acc[entry.account_code] = {
                code: entry.account_code,
                name: entry.account_name,
                debit: 0,
                credit: 0,
                balance: 0
            }
        }
        acc[entry.account_code].debit += entry.debit
        acc[entry.account_code].credit += entry.credit
        
        // Lógica de Naturaleza de Cuenta:
        // Activo (1) o Gasto (5): Debe - Haber
        // Pasivo (2), Patrimonio (3) o Ingreso (4): Haber - Debe
        const isDebitNature = entry.account_code.startsWith('1') || entry.account_code.startsWith('5');
        
        if (isDebitNature) {
            acc[entry.account_code].balance = acc[entry.account_code].debit - acc[entry.account_code].credit;
            acc[entry.account_code].nature = 'Dt';
        } else {
            acc[entry.account_code].balance = acc[entry.account_code].credit - acc[entry.account_code].debit;
            acc[entry.account_code].nature = 'Cr';
        }
        return acc
    }, {} as Record<string, any>)

    const accounts = Object.values(accountsMap).sort((a, b) => a.code.localeCompare(b.code))

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <h3 className="text-lg font-bold text-gray-900">Resumen de Cuentas (Mayor)</h3>
                <div className="flex space-x-2 w-full sm:w-auto">
                    {onNewEntry && (
                        <button
                            onClick={onNewEntry}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm text-sm font-bold hover:bg-primary-700 transition-all active:scale-95"
                        >
                            + Nuevo Asiento
                        </button>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 uppercase text-[10px] font-bold text-gray-500 tracking-wider">
                    <tr>
                        <th className="px-4 py-3 text-left">Código</th>
                        <th className="px-4 py-3 text-left">Cuenta</th>
                        <th className="px-4 py-3 text-right">Sumas Debe</th>
                        <th className="px-4 py-3 text-right">Sumas Haber</th>
                        <th className="px-4 py-3 text-right">Saldo Neto</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 text-sm">
                    {accounts.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                                No hay datos para mostrar
                            </td>
                        </tr>
                    ) : (
                        accounts.map((acc) => (
                            <tr key={acc.code} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-gray-900">{acc.code}</td>
                                <td className="px-4 py-3 font-medium text-gray-700">{acc.name}</td>
                                <td className="px-4 py-3 text-right font-mono">${acc.debit.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                                <td className="px-4 py-3 text-right font-mono">${acc.credit.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                                <td className={`px-4 py-3 text-right font-bold font-mono ${acc.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ${Math.abs(acc.balance).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                    <span className="text-[10px] ml-1">{acc.nature}</span>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
        </div>
    )
}
