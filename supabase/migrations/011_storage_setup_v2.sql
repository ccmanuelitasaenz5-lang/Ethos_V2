-- Configuración Automática de Storage para Expediente Digital (Versión Corregida)
-- Ejecuta este script en el SQL Editor de Supabase.
-- 1. Crear el bucket 'documents' si no existe
INSERT INTO storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
    )
VALUES (
        'documents',
        'documents',
        true,
        10485760,
        -- 10MB
        ARRAY ['image/jpeg', 'image/png', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    ) ON CONFLICT (id) DO
UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
-- 2. (Omitido) Habilitar RLS en storage.objects suele dar error de permisos y ya viene activo por defecto.
-- 3. Crear Políticas de Seguridad
-- Nota: Si alguna falla porque ya existe, puedes ignorar el error o borrarla manualmente antes.
-- Política de Lectura
DROP POLICY IF EXISTS "Users can view documents" ON storage.objects;
CREATE POLICY "Users can view documents" ON storage.objects FOR
SELECT TO authenticated USING (
        bucket_id = 'documents'
        AND (storage.foldername(name)) [1] IN (
            SELECT organization_id::text
            FROM public.users
            WHERE id = auth.uid()
        )
    );
-- Política de Escritura
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
CREATE POLICY "Users can upload documents" ON storage.objects FOR
INSERT TO authenticated WITH CHECK (
        bucket_id = 'documents'
        AND (storage.foldername(name)) [1] IN (
            SELECT organization_id::text
            FROM public.users
            WHERE id = auth.uid()
        )
    );
-- Política de Borrado
DROP POLICY IF EXISTS "Users can delete documents" ON storage.objects;
CREATE POLICY "Users can delete documents" ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'documents'
    AND (storage.foldername(name)) [1] IN (
        SELECT organization_id::text
        FROM public.users
        WHERE id = auth.uid()
    )
);
-- 4. Crear tabla de documentos (Metadata)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE
    SET NULL,
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
-- Políticas RLS para la tabla documents (Esto sí debería funcionar sin problemas)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view documents in their organization" ON public.documents;
CREATE POLICY "Users can view documents in their organization" ON public.documents FOR
SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM public.users
            WHERE id = auth.uid()
        )
    );
DROP POLICY IF EXISTS "Users can insert documents" ON public.documents;
CREATE POLICY "Users can insert documents" ON public.documents FOR
INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM public.users
            WHERE id = auth.uid()
        )
    );
DROP POLICY IF EXISTS "Users can delete documents" ON public.documents;
CREATE POLICY "Users can delete documents" ON public.documents FOR DELETE USING (
    organization_id IN (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
    )
);