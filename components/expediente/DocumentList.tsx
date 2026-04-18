'use client'

import { useEffect, useState, useTransition } from 'react'
import { listDocuments, deleteDocument, getDownloadUrl } from '@/app/actions/documents'
import type { DocumentWithUrl } from '@/app/actions/documents'
import toast from 'react-hot-toast'

// ─── iconos inline (evita importar toda la librería solo para esto) ───────────
const IconDoc = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
  </svg>
)
const IconDownload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7,10 12,15 17,10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="3,6 5,6 21,6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
)

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-VE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

type Props = {
  userRole: 'admin' | 'auditor' | 'resident'
}

export default function DocumentList({ userRole }: Props) {
  const [docs, setDocs] = useState<DocumentWithUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Cargar documentos al montar (y cada vez que se llame refresh)
  const loadDocs = async () => {
    setLoading(true)
    const result = await listDocuments()
    if (result.error) {
      toast.error(result.error)
    } else {
      setDocs(result.data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { loadDocs() }, [])

  // Las URLs firmadas duran 1 hora — refrescar automáticamente cada 55 min
  useEffect(() => {
    const interval = setInterval(loadDocs, 55 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleDownload = async (doc: DocumentWithUrl) => {
    setDownloadingId(doc.id)
    try {
      // Si la URL firmada del listado aún es válida, usarla directamente
      if (doc.signed_url) {
        window.open(doc.signed_url, '_blank', 'noopener,noreferrer')
      } else {
        // Generar una URL fresca de descarga (con Content-Disposition: attachment)
        const result = await getDownloadUrl(doc.file_path)
        if (result.error) {
          toast.error(`Error al generar enlace: ${result.error}`)
        } else {
          window.open(result.url!, '_blank', 'noopener,noreferrer')
        }
      }
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (doc: DocumentWithUrl) => {
    if (!confirm(`¿Eliminar "${doc.title}"? Esta acción no se puede deshacer.`)) return

    setDeletingId(doc.id)
    startTransition(async () => {
      const result = await deleteDocument(doc.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Documento eliminado')
        setDocs((prev) => prev.filter((d) => d.id !== doc.id))
      }
      setDeletingId(null)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
        Cargando documentos…
      </div>
    )
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <div className="text-4xl mb-3 opacity-30">📄</div>
        <p className="text-sm">No hay documentos subidos aún</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Documento</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Tipo</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Tamaño</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Fecha</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {docs.map((doc) => (
            <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 shrink-0"><IconDoc /></span>
                  <div>
                    <p className="font-medium text-gray-900 truncate max-w-[200px]">{doc.title}</p>
                    {doc.description && (
                      <p className="text-xs text-gray-400 truncate max-w-[200px]">{doc.description}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                {doc.mime_type?.split('/')[1]?.toUpperCase() ?? '—'}
              </td>
              <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                {formatFileSize(doc.file_size)}
              </td>
              <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                {formatDate(doc.uploaded_at)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                    title="Descargar"
                    className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                  >
                    {downloadingId === doc.id ? (
                      <span className="text-xs">…</span>
                    ) : (
                      <IconDownload />
                    )}
                  </button>

                  {userRole === 'admin' && (
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={deletingId === doc.id || isPending}
                      title="Eliminar"
                      className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      {deletingId === doc.id ? (
                        <span className="text-xs">…</span>
                      ) : (
                        <IconTrash />
                      )}
                    </button>
                  )}

                  {!doc.signed_url && (
                    <span
                      title="URL expirada — se generará una nueva al descargar"
                      className="text-xs text-amber-500"
                    >
                      ⚠
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
