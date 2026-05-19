'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Asset } from '@/types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrashIcon, ArrowDownTrayIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { deleteAsset, updateAssetStatus } from '@/app/actions/assets'
import * as XLSX from 'xlsx'
import PrintHeader from '@/components/layout/PrintHeader'
import Pagination from '@/components/shared/Pagination'
import { toast } from 'react-hot-toast'
import { getTotalPages } from '@/lib/pagination'

interface AssetTableProps {
    assets: Asset[]
    organizationName?: string
    totalItems: number
    currentPage: number
    itemsPerPage: number
    filters: {
        status: string
        category: string
    }
}

export default function AssetTable({
    assets,
    organizationName = 'Organización',
    totalItems,
    currentPage,
    itemsPerPage,
    filters
}: AssetTableProps) {
    const router = useRouter()
    const [deleting, setDeleting] = useState<string | null>(null)

    const totalPages = getTotalPages(totalItems, itemsPerPage)

    async function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de eliminar este activo?')) return

        setDeleting(id)
        const result = await deleteAsset(id)
        setDeleting(null)

        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success('Activo eliminado correctamente')
            router.refresh()
        }
    }

    function updateFilters(newFilters: Partial<typeof filters>) {
        const params = new URLSearchParams(window.location.search)
        Object.entries(newFilters).forEach(([key, value]) => {
            if (value === 'all') {
                params.delete(key)
            } else {
                params.set(key, value as string)
            }
        })
        params.set('page', '1') // Reset to first page on filter change
        router.push(`/dashboard/inventario?${params.toString()}`)
    }

    function handlePageChange(page: number) {
        const params = new URLSearchParams(window.location.search)
        params.set('page', page.toString())
        router.push(`/dashboard/inventario?${params.toString()}`)
    }

    async function handleStatusChange(id: string, status: 'active' | 'inactive' | 'disposed') {
        const result = await updateAssetStatus(id, status)
        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success('Estado actualizado')
            router.refresh()
        }
    }

    function handleExport() {
        const data = assets.map(asset => {
            const netValue = (asset.cost_usd || 0) - (asset.accumulated_depreciation || 0)
            return {
                'Nombre': asset.name,
                'Categoría': asset.category || '-',
                'Fecha de Compra': format(new Date((asset.purchase_date ? asset.purchase_date + 'T12:00:00' : null) || new Date()), 'dd/MM/yyyy', { locale: es }),
                'Costo USD': asset.cost_usd || 0,
                'Vida Útil (meses)': asset.useful_life_months || 0,
                'Depreciación Mensual': asset.depreciation_monthly || 0,
                'Depreciación Acumulada': asset.accumulated_depreciation || 0,
                'Valor Neto': netValue,
                'Ubicación': asset.location || '-',
                'Estado': asset.status,
            }
        })

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(data)
        XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
        XLSX.writeFile(wb, `Inventario_${organizationName}.xlsx`)
    }

    function handlePrint() {
        window.print()
    }

    // Categories extraction should ideally happen on the server or be passed as props
    // For now, we'll use "all" or specific ones from the data.
    const categories = Array.from(new Set(assets.map(a => a.category).filter(Boolean)))

    return (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
            <PrintHeader title="Inventario de Activos Fijos" organizationName={organizationName} />
            <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 no-print bg-gray-50/50">
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={filters.status}
                        onChange={(e) => updateFilters({ status: e.target.value })}
                        className="text-xs border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                        <option value="disposed">Dados de baja</option>
                    </select>
                    <select
                        value={filters.category}
                        onChange={(e) => updateFilters({ category: e.target.value })}
                        className="text-xs border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white"
                    >
                        <option value="all">Todas las categorías</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat!}>{cat}</option>
                        ))}
                    </select>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        {totalItems} activos totales
                    </span>
                </div>

                <div className="flex space-x-2">
                    <button
                        onClick={handlePrint}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        <PrinterIcon className="h-4 w-4 mr-2 text-gray-500" />
                        PDF
                    </button>
                    <button
                        onClick={handleExport}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                        Excel
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo USD</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Depreciación</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Neto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {assets.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                    No hay activos que coincidan con los filtros
                                </td>
                            </tr>
                        ) : (
                            assets.map((asset) => {
                                const netValue = (asset.cost_usd || 0) - (asset.accumulated_depreciation || 0)
                                const depreciationPercent = asset.cost_usd ? ((asset.accumulated_depreciation || 0) / asset.cost_usd) * 100 : 0

                                return (
                                    <tr key={asset.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            <div>
                                                <p className="font-medium">{asset.name}</p>
                                                {asset.location && (
                                                    <p className="text-xs text-gray-500">{asset.location}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {asset.category || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            ${asset.cost_usd?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            <div>
                                                <p className="font-medium text-orange-600">
                                                    ${asset.accumulated_depreciation?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {depreciationPercent.toFixed(1)}% depreciado
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    ${asset.depreciation_monthly?.toFixed(2)}/mes
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                                            ${netValue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <select
                                                value={asset.status}
                                                onChange={(e) => handleStatusChange(asset.id, e.target.value as 'active' | 'inactive' | 'disposed')}
                                                className={`text-xs font-semibold rounded-full px-2 py-1 ${asset.status === 'active'
                                                    ? 'bg-green-100 text-green-800'
                                                    : asset.status === 'inactive'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                <option value="active">Activo</option>
                                                <option value="inactive">Inactivo</option>
                                                <option value="disposed">Dado de baja</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleDelete(asset.id)}
                                                disabled={deleting === asset.id}
                                                className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                                title="Eliminar"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={handlePageChange}
                />
            )}
        </div>
    )
}
