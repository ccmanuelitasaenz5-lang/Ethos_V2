-- Configuración Automática de Storage para Expediente Digital
-- Ejecuta este script en el SQL Editor de Supabase para configurar todo automáticamente.
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
        -- 10MB limit
        ARRAY ['image/jpeg', 'image/png', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    ) ON CONFLICT (id) DO
UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
-- 2. Habilitar RLS en storage.objects (por seguridad, suele estar activo por defecto)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
-- 3. Eliminar políticas existentes para evitar conflictos
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to view their organization files" ON storage.objects;
DROP POLICY IF EXISTS "Allow admins to delete files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents" ON storage.objects;
-- 4. Crear Políticas de Seguridad
-- Política de Lectura (SELECT): Usuarios pueden ver archivos de su organización
CREATE POLICY "Users can view documents" ON storage.objects FOR
SELECT TO authenticated USING (
        bucket_id = 'documents'
        AND (storage.foldername(name)) [1] IN (
            SELECT organization_id::text
            FROM public.users
            WHERE id = auth.uid()
        )
    );
-- Política de Escritura (INSERT): Usuarios autenticados pueden subir archivos
CREATE POLICY "Users can upload documents" ON storage.objects FOR
INSERT TO authenticated WITH CHECK (
        bucket_id = 'documents'
        AND (storage.foldername(name)) [1] IN (
            SELECT organization_id::text
            FROM public.users
            WHERE id = auth.uid()
        )
    );
-- Política de Borrado (DELETE): Usuarios pueden borrar archivos de su organización
-- Nota: En producción idealmente solo Admin, pero para facilitar uso permitimos a usuarios borrar lo que suben
CREATE POLICY "Users can delete documents" ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'documents'
    AND (storage.foldername(name)) [1] IN (
        SELECT organization_id::text
        FROM public.users
        WHERE id = auth.uid()
    )
);
-- 5. Crear tabla de documentos si no existe (normalmente ya creada en migración anterior, pero aseguramos)
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
-- Políticas RLS para la tabla documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view documents in their organization" ON public.documents;
DROP POLICY IF EXISTS "Admins can manage documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete documents" ON public.documents;
CREATE POLICY "Users can view documents in their organization" ON public.documents FOR
SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM public.users
            WHERE id = auth.uid()
        )
    );
CREATE POLICY "Users can insert documents" ON public.documents FOR
INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM public.users
            WHERE id = auth.uid()
        )
    );
CREATE POLICY "Users can delete documents" ON public.documents FOR DELETE USING (
    organization_id IN (
        SELECT organization_id
        FROM public.users
        WHERE id = auth.uid()
    )
);