-- =====================================================
-- 026: Corrección crítica de RLS (organization_id vía JWT obsoleto)
--       + Política de INSERT faltante en security_logs
-- =====================================================
--
-- PROBLEMA DETECTADO:
-- Las migraciones 019 y 023 crearon la función get_auth_org_id(),
-- usada en las políticas RLS de transactions_income, transactions_expense,
-- bank_accounts, assets, accounting_entries y accounting_entry_items.
-- Esa función lee organization_id desde el JWT (auth.jwt() -> user_metadata),
-- pero ese campo NUNCA se establece durante el signup, y solo se sincroniza
-- de forma parcial en app/dashboard/layout.tsx (admin.updateUserById), lo
-- cual NO actualiza el token de sesión ya emitido/cacheado en las cookies
-- del usuario. Resultado: organization_id = NULL en el JWT la mayoría del
-- tiempo, por lo que las políticas "organization_id = get_auth_org_id()"
-- nunca se cumplen (NULL no es igual a nada) y el usuario ve tablas vacías
-- o recibe errores "new row violates row-level security policy" al crear
-- ingresos, gastos, movimientos bancarios o activos.
--
-- SOLUCIÓN:
-- Redefinir get_auth_org_id() para que lea organization_id directamente
-- desde la tabla public.users (fuente de verdad), usando SECURITY DEFINER
-- para evitar recursión de RLS, igual que ya se hace correctamente con
-- get_auth_organization() desde la migración 002. Como todas las políticas
-- ya referencian get_auth_org_id() por nombre, este fix se propaga
-- automáticamente sin tener que tocar cada política una por una.

CREATE OR REPLACE FUNCTION public.get_auth_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid();
$$;

-- =====================================================
-- FIX 2: Falta política de INSERT en security_logs
-- =====================================================
-- Sin esta política, RLS bloquea por defecto todos los INSERT hechos con
-- el cliente anon/authenticated (lib/security/logs.ts -> logSecurityEvent),
-- por lo que ningún intento de login/signup fallido queda registrado y el
-- rate limiting (check_rate_limit) siempre ve 0 intentos -> nunca bloquea.

DROP POLICY IF EXISTS security_logs_insert_all ON public.security_logs;
CREATE POLICY security_logs_insert_all ON public.security_logs
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- =====================================================
-- Verificación rápida (opcional, puedes ejecutar manualmente):
-- SELECT get_auth_org_id(); -- debe devolver tu organization_id, no NULL
-- =====================================================
