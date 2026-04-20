-- ============================================================
-- 021_limit_organization_creation.sql
-- Restringe la creación de organizaciones para evitar abusos.
-- Por defecto, un usuario solo puede ser dueño de 1 organización.
-- ============================================================

-- 1. Función para verificar el límite de organizaciones por usuario
CREATE OR REPLACE FUNCTION public.check_organization_limit()
RETURNS TRIGGER AS $$
DECLARE
    org_count INTEGER;
BEGIN
    -- Contar cuántas organizaciones ha creado el usuario actual
    -- (Asumiendo que hay una columna 'created_by' en organizations)
    -- Si no existe 'created_by', usamos la relación en la tabla 'users'
    
    SELECT COUNT(*) INTO org_count 
    FROM public.users 
    WHERE id = auth.uid() AND role = 'admin';

    IF org_count >= 1 THEN
        RAISE EXCEPTION 'Límite de organizaciones alcanzado. Solo se permite 1 organización por cuenta básica.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger para aplicar la validación antes de insertar en 'organizations'
-- Nota: Solo habilitar si la tabla tiene rastro de quién la crea o si se 
-- valida mediante la tabla de perfiles.
-- Como el flujo de Ethos es Signup -> Org -> Profile, 
-- protegeremos la tabla 'organizations' mediante RLS más estricto.

-- 3. Hardening de RLS para Organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_read_own" ON public.organizations;
CREATE POLICY "org_read_own" ON public.organizations
FOR SELECT TO authenticated
USING (
    id IN (SELECT organization_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "org_update_admin" ON public.organizations;
CREATE POLICY "org_update_admin" ON public.organizations
FOR UPDATE TO authenticated
USING (
    id IN (SELECT organization_id FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
    id IN (SELECT organization_id FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Restricción en la tabla users para unicidad (opcional pero recomendado)
-- Un usuario solo puede pertenecer a una organización a la vez.
-- El ID de la tabla users ya es la PK (auth.uid()), lo que garantiza 1 perfil por usuario.
