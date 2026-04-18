'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// ─── cliente servidor (usa cookies de sesión, NO service role) ───────────────
async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {},    // server actions no pueden mutar cookies aquí
        remove: () => {},
      },
    }
  )
}

// ─── cliente admin (solo para operaciones que requieren bypass de RLS) ────────
// IMPORTANTE: este cliente NUNCA debe usarse en código que pueda llegar al bundle cliente
function createAdminClient() {
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const BUCKET = 'documents'
const SIGNED_URL_EXPIRY = 60 * 60 // 1 hora en segundos

// ─── tipos ────────────────────────────────────────────────────────────────────
export type DocumentRecord = {
  id: string
  organization_id: string
  title: string
  description: string | null
  file_path: string      // ruta en Storage: {org_id}/{filename}
  file_size: number | null
  mime_type: string | null
  uploaded_by: string | null
  uploaded_at: string
}

export type DocumentWithUrl = DocumentRecord & {
  signed_url: string | null
}

// ─── helper: obtener organización del usuario actual ─────────────────────────
async function getUserOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  return data?.organization_id ?? null
}

// ─── 1. SUBIR DOCUMENTO ───────────────────────────────────────────────────────
export async function uploadDocument(formData: FormData) {
  const supabase = await createClient()
  const orgId = await getUserOrgId(supabase)

  if (!orgId) {
    return { error: 'No autorizado: sin organización asignada' }
  }

  const file = formData.get('file') as File | null
  const title = formData.get('title') as string
  const description = formData.get('description') as string | null

  if (!file || !title) {
    return { error: 'Archivo y título son obligatorios' }
  }

  // Validaciones de seguridad
  const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
  if (file.size > MAX_SIZE) {
    return { error: 'El archivo supera el límite de 10 MB' }
  }

  const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
  ]
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'Tipo de archivo no permitido' }
  }

  // Ruta: {organization_id}/{timestamp}-{nombre_sanitizado}
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `${orgId}/${Date.now()}-${safeName}`

  // Subir al bucket PRIVADO
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    return { error: `Error al subir el archivo: ${uploadError.message}` }
  }

  // Registrar en la tabla documents (guardamos la ruta, no la URL pública)
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error: dbError } = await supabase
    .from('documents')
    .insert({
      organization_id: orgId,
      title,
      description: description || null,
      file_path: filePath,           // ← ruta relativa, no URL pública
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single()

  if (dbError) {
    // Si falló el registro en BD, eliminar el archivo subido para no dejar huérfanos
    await supabase.storage.from(BUCKET).remove([filePath])
    console.error('DB insert error:', dbError)
    return { error: 'Error al registrar el documento en la base de datos' }
  }

  revalidatePath('/dashboard/expediente')
  return { data }
}

// ─── 2. LISTAR DOCUMENTOS CON URLs FIRMADAS ──────────────────────────────────
// Las URLs firmadas se generan en el servidor y duran 1 hora.
// El cliente nunca ve ni almacena claves de acceso.
export async function listDocuments(): Promise<{ data?: DocumentWithUrl[]; error?: string }> {
  const supabase = await createClient()
  const orgId = await getUserOrgId(supabase)

  if (!orgId) {
    return { error: 'No autorizado' }
  }

  // Obtener registros de la BD
  const { data: docs, error: dbError } = await supabase
    .from('documents')
    .select('*')
    .eq('organization_id', orgId)
    .order('uploaded_at', { ascending: false })
    .range(0, 49) // paginación básica: primeros 50

  if (dbError) {
    return { error: dbError.message }
  }

  if (!docs || docs.length === 0) {
    return { data: [] }
  }

  // Generar URLs firmadas para todos los documentos de una vez (batch)
  const paths = docs.map((d) => d.file_path)
  const { data: signedUrls, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_EXPIRY)

  if (signedError) {
    console.error('Error generando URLs firmadas:', signedError)
    // Devolver documentos sin URL en lugar de fallar completamente
    return {
      data: docs.map((d) => ({ ...d, signed_url: null })),
    }
  }

  // Combinar registros con sus URLs firmadas
  const urlMap = new Map((signedUrls || []).map((u) => [u.path, u.signedUrl]))

  const result: DocumentWithUrl[] = docs.map((d) => ({
    ...d,
    signed_url: urlMap.get(d.file_path) ?? null,
  }))

  return { data: result }
}

// ─── 3. OBTENER URL FIRMADA INDIVIDUAL (para descarga puntual) ────────────────
export async function getSignedUrl(
  filePath: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const orgId = await getUserOrgId(supabase)

  if (!orgId) {
    return { error: 'No autorizado' }
  }

  // Verificar que el archivo pertenece a la organización del usuario
  // (la ruta siempre comienza con el org_id)
  if (!filePath.startsWith(`${orgId}/`)) {
    return { error: 'Acceso denegado a este archivo' }
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY)

  if (error) {
    return { error: error.message }
  }

  return { url: data.signedUrl }
}

// ─── 4. OBTENER URL FIRMADA PARA DESCARGA FORZADA (Content-Disposition: attachment) ──
export async function getDownloadUrl(
  filePath: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const orgId = await getUserOrgId(supabase)

  if (!orgId) return { error: 'No autorizado' }

  if (!filePath.startsWith(`${orgId}/`)) {
    return { error: 'Acceso denegado' }
  }

  // El tercer argumento fuerza la descarga en lugar de abrir en el navegador
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY, {
      download: true,
    })

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

// ─── 5. ELIMINAR DOCUMENTO ────────────────────────────────────────────────────
export async function deleteDocument(
  documentId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const orgId = await getUserOrgId(supabase)

  if (!orgId) return { error: 'No autorizado' }

  // Obtener el documento para verificar pertenencia y obtener la ruta
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('file_path, organization_id')
    .eq('id', documentId)
    .eq('organization_id', orgId) // RLS extra: solo su organización
    .single()

  if (fetchError || !doc) {
    return { error: 'Documento no encontrado o sin permiso' }
  }

  // Eliminar de Storage primero
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([doc.file_path])

  if (storageError) {
    console.error('Storage delete error:', storageError)
    return { error: 'Error al eliminar el archivo del storage' }
  }

  // Eliminar registro de BD
  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)

  if (dbError) {
    return { error: 'Archivo eliminado del storage pero error en BD' }
  }

  revalidatePath('/dashboard/expediente')
  return {}
}
