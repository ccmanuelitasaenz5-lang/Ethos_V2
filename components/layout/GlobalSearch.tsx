'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MagnifyingGlassIcon, XMarkIcon, CalendarIcon, CurrencyDollarIcon, CubeIcon, BookOpenIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { format } from 'date-fns'

interface SearchResult {
    id: string
    type: 'income' | 'expense' | 'asset' | 'journal'
    title: string
    subtitle: string
    date?: string
    amount?: number
    href: string
}

export default function GlobalSearch() {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [loading, setLoading] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault()
                setIsOpen(true)
            }
            if (e.key === 'Escape') setIsOpen(false)
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    useEffect(() => {
        if (query.length < 3) {
            setResults([])
            return
        }

        const timer = setTimeout(async () => {
            setLoading(true)
            const supabase = createClient()

            const [incomes, expenses, assets, journals] = await Promise.all([
                supabase.from('transactions_income').select('id, concept, amount_usd, date').ilike('concept', `%${query}%`).limit(3),
                supabase.from('transactions_expense').select('id, concept, supplier, amount_usd, date').or(`concept.ilike.%${query}%,supplier.ilike.%${query}%`).limit(3),
                supabase.from('assets').select('id, name, category, cost_usd').ilike('name', `%${query}%`).limit(3),
                supabase.from('journal_entries').select('id, description, account_name, debit, credit, date').ilike('description', `%${query}%`).limit(3)
            ])

            const combined: SearchResult[] = [
                ...(incomes.data?.map(i => ({
                    id: i.id,
                    type: 'income' as const,
                    title: i.concept,
                    subtitle: 'Ingreso',
                    date: i.date,
                    amount: i.amount_usd,
                    href: '/dashboard/ingresos'
                })) || []),
                ...(expenses.data?.map(e => ({
                    id: e.id,
                    type: 'expense' as const,
                    title: `${e.supplier} - ${e.concept}`,
                    subtitle: 'Gasto',
                    date: e.date,
                    amount: e.amount_usd,
                    href: '/dashboard/gastos'
                })) || []),
                ...(assets.data?.map(a => ({
                    id: a.id,
                    type: 'asset' as const,
                    title: a.name,
                    subtitle: `Activo (${a.category || '-'})`,
                    amount: a.cost_usd,
                    href: '/dashboard/inventario'
                })) || []),
                ...(journals.data?.map(j => ({
                    id: j.id,
                    type: 'journal' as const,
                    title: j.description,
                    subtitle: `Diario (${j.account_name})`,
                    date: j.date,
                    amount: j.debit || j.credit,
                    href: '/dashboard/libro-digital'
                })) || [])
            ]

            setResults(combined)
            setLoading(false)
        }, 400)

        return () => clearTimeout(timer)
    }, [query])

    if (!isOpen) return (
        <button
            onClick={() => setIsOpen(true)}
            className="hidden md:flex items-center px-4 py-2 bg-gray-100 rounded-xl text-gray-500 hover:bg-gray-200 transition-all w-72 group border border-transparent hover:border-gray-300"
        >
            <MagnifyingGlassIcon className="h-5 w-5 mr-3 group-hover:text-primary-600" />
            <span className="text-sm">Buscar algo...</span>
            <kbd className="ml-auto text-xs bg-white px-2 py-0.5 rounded border shadow-sm">Ctrl + K</kbd>
        </button>
    )

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                ref={searchRef}
                className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300"
            >
                <div className="p-4 border-b border-gray-100 flex items-center">
                    <MagnifyingGlassIcon className="h-6 w-6 text-primary-600 mr-3" />
                    <input
                        autoFocus
                        type="text"
                        placeholder="Escribe para buscar ingresos, gastos, activos..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-lg text-gray-900 placeholder-gray-400"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                        <XMarkIcon className="h-6 w-6 text-gray-400" />
                    </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                    {loading && <div className="text-center py-8 text-gray-500 animate-pulse font-medium">Buscando...</div>}

                    {!loading && query.length > 0 && results.length === 0 && (
                        <div className="text-center py-8 text-gray-500">No se encontraron resultados para "{query}"</div>
                    )}

                    {!loading && results.map((res) => (
                        <Link
                            key={`${res.type}-${res.id}`}
                            href={res.href}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center p-3 hover:bg-primary-50 rounded-xl transition-all group"
                        >
                            <div className={`p-3 rounded-xl mr-4 ${res.type === 'income' ? 'bg-green-100 text-green-600' :
                                    res.type === 'expense' ? 'bg-red-100 text-red-600' :
                                        res.type === 'asset' ? 'bg-blue-100 text-blue-600' :
                                            'bg-purple-100 text-purple-600'
                                }`}>
                                {res.type === 'income' && <CurrencyDollarIcon className="h-6 w-6" />}
                                {res.type === 'expense' && <CurrencyDollarIcon className="h-6 w-6" />}
                                {res.type === 'asset' && <CubeIcon className="h-6 w-6" />}
                                {res.type === 'journal' && <BookOpenIcon className="h-6 w-6" />}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-gray-900 group-hover:text-primary-600 transition-colors uppercase tracking-tight">{res.title}</p>
                                <div className="flex items-center text-xs text-gray-500 mt-0.5 space-x-3">
                                    <span className="font-semibold uppercase text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{res.subtitle}</span>
                                    {res.date && (
                                        <span className="flex items-center">
                                            <CalendarIcon className="h-3 w-3 mr-1" />
                                            {format(new Date(res.date + 'T12:00:00'), 'dd/MM/yyyy')}
                                        </span>
                                    )}
                                    {res.amount !== undefined && (
                                        <span className="font-mono font-bold text-gray-700">
                                            ${res.amount.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}

                    {query.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p className="text-sm">Busca cualquier registro contable por nombre, concepto o proveedor</p>
                            <p className="text-[10px] mt-2 uppercase tracking-widest font-bold">ETHOS v2.0 AI SEARCH</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
