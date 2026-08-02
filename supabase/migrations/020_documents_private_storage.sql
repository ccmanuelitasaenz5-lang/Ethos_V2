-- ============================================================
-- 020_documents_private_storage.sql
-- Convierte el bucket 'documents' a PRIVADO y actualiza la
-- tabla documents para guardar file_path en lugar de file_url.
-- IDEMPOTENTE: puede ejecutarse múltiples veces sin error.
-- ============================================================
-- ────────────────────────────────────────────────────────────
-- 1. Hacer el bucket PRIVADO
--    (si ya existe como público, lo convierte a privado)
-- ────────────────────────────────────────────────────────────
-- Verificar si la columna 'public' existe antes de actualizar
DO $$ BEGIN -- Actualizar bucket existente si la columna existe
IF EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'storage'
    AND table_name = 'buckets'
    AND column_name = 'public'
) THEN
UPDATE storage.buckets
SET public = FALSE
WHERE id = 'documents';
END IF;
END $$;
-- Si el bucket no existe aún, crearlo como privado:
INSERT INTO storage.buckets (id, name)
VALUES ('documents', 'documents') ON CONFLICT (id) DO NOTHING;
-- Nota: La configuración de privacidad se maneja mediante políticas RLS
-- No es necesario establecer 'public = false' explícitamente en versiones nuevas
-- ────────────────────────────────────────────────────────────
-- 2. Actualizar tabla documents: reemplazar file_url por file_path
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN -- Agregar columna file_path si no existe
IF NOT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'file_path'
) THEN
ALTER TABLE public.documents
ADD COLUMN file_path TEXT;
END IF;
-- Migrar datos de file_url a file_path si la columna antigua existe
IF EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'file_url'
) THEN
UPDATE public.documents
SET file_path = REGEXP_REPLACE(file_url, '^.*/documents/', '')
WHERE file_path IS NULL
  AND file_url IS NOT NULL;
-- Eliminar la columna antigua
ALTER TABLE public.documents DROP COLUMN IF EXISTS file_url;
END IF;
-- Hacer file_path NOT NULL una vez migrado (solo si hay datos)
IF NOT EXISTS (
  SELECT 1
  FROM public.documents
  WHERE file_path IS NULL
  LIMIT 1
) THEN
ALTER TABLE public.documents
ALTER COLUMN file_path
SET NOT NULL;
END IF;
END $$;
-- ────────────────────────────────────────────────────────────
-- 3. Limpiar y recrear políticas de Storage
-- ────────────────────────────────────────────────────────────
-- Limpieza de políticas antiguas
DROP POLICY IF EXISTS "Users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "ethos_doc_upload" ON storage.objects;
DROP POLICY IF EXISTS "ethos_doc_read" ON storage.objects;
DROP POLICY IF EXISTS "ethos_doc_delete" ON storage.objects;
-- A. SUBIR archivos (Solo Admin)
CREATE POLICY "ethos_doc_upload" ON storage.objects FOR
INSERT TO authenticated WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name)) [1] IN (
      SELECT organization_id::text
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );
-- B. LEER archivos (Cualquier miembro)
CREATE POLICY "ethos_doc_read" ON storage.objects FOR
SELECT TO authenticated USING (
    bucket_id = 'documents'
    AND (storage.foldername(name)) [1] IN (
      SELECT organization_id::text
      FROM public.users
      WHERE id = auth.uid()
    )
  );
-- C. ELIMINAR archivos (Solo Admin)
CREATE POLICY "ethos_doc_delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'documents'
  AND (storage.foldername(name)) [1] IN (
    SELECT organization_id::text
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);
-- ────────────────────────────────────────────────────────────
-- 4. Actualizar políticas RLS de la tabla public.documents
-- ────────────────────────────────────────────────────────────
-- Limpieza
DROP POLICY IF EXISTS "Users can view documents in their organization" ON public.documents;
DROP POLICY IF EXISTS "Admins can manage documents" ON public.documents;
DROP POLICY IF EXISTS "doc_read_org" ON public.documents;
DROP POLICY IF EXISTS "doc_write_admin" ON public.documents;
DROP POLICY IF EXISTS "doc_delete_admin" ON public.documents;
DROP POLICY IF EXISTS "doc_service_all" ON public.documents;
-- Lectura: Miembros de la organización
CREATE POLICY "doc_read_org" ON public.documents FOR
SELECT TO authenticated USING (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );
-- Escritura: Admins
CREATE POLICY "doc_write_admin" ON public.documents FOR
INSERT TO authenticated WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );
-- Eliminación: Admins
CREATE POLICY "doc_delete_admin" ON public.documents FOR DELETE TO authenticated USING (
  organization_id IN (
    SELECT organization_id
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);
-- Acceso Service Role (Sin restricciones)
CREATE POLICY "doc_service_all" ON public.documents FOR ALL TO service_role USING (true) WITH CHECK (true);
-- ────────────────────────────────────────────────────────────
-- 5. Índices adicionales
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_documents_file_path ON public.documents(file_path);
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON public.documents(organization_id);
