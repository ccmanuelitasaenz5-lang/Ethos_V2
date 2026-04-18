'use client'

import { useState, useRef } from 'react'
import { uploadDocument } from '@/app/actions/documents'
import toast from 'react-hot-toast'

const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png'
const MAX_MB = 10

type Props = {
  onSuccess?: () => void  // callback para refrescar el listado tras subir
}

export default function DocumentUploadForm({ onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (file && file.size > MAX_MB * 1024 * 1024) {
      toast.error(`El archivo supera los ${MAX_MB} MB permitidos`)
      e.target.value = ''
      setSelectedFile(null)
      return
    }
    setSelectedFile(file)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedFile) {
      toast.error('Selecciona un archivo')
      return
    }

    setUploading(true)
    const formData = new FormData(e.currentTarget)

    try {
      const result = await uploadDocument(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Documento subido correctamente')
        formRef.current?.reset()
        setSelectedFile(null)
        setOpen(false)
        onSuccess?.()
      }
    } catch {
      toast.error('Error inesperado al subir el documento')
    } finally {
      setUploading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        <span>+</span> Subir Documento
      </button>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-gray-900">Subir nuevo documento</h3>
        <button
          onClick={() => { setOpen(false); setSelectedFile(null) }}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            required
            maxLength={200}
            placeholder="Ej: Acta de asamblea marzo 2026"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            name="description"
            rows={2}
            maxLength={500}
            placeholder="Breve descripción del documento…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Archivo <span className="text-red-500">*</span>
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              name="file"
              accept={ALLOWED_EXTENSIONS}
              required
              onChange={handleFileChange}
              className="hidden"
              id="doc-file-input"
            />
            <label htmlFor="doc-file-input" className="cursor-pointer">
              {selectedFile ? (
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-gray-400 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  <p>Haz clic para seleccionar un archivo</p>
                  <p className="text-xs text-gray-400 mt-1">
                    PDF, Word, Excel, JPG, PNG — máx. {MAX_MB} MB
                  </p>
                </div>
              )}
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Subiendo…' : 'Subir Documento'}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setSelectedFile(null) }}
            disabled={uploading}
            className="px-4 py-2 text-gray-600 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
