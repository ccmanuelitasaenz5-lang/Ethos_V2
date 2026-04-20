-- =====================================================
-- 015: Funciones de Auth, Actualización de RLS y Vistas
-- =====================================================

-- 1. Función para obtener organization_id del JWT
CREATE OR REPLACE FUNCTION get_auth_org_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'organization_id')::UUID;
$$ LANGUAGE sql STABLE;

-- 2. Actualizar políticas RLS para usar la nueva función
-- Nota: Primero eliminamos las antiguas si existen para evitar conflictos
-- Ingresos
DROP POLICY IF EXISTS "Users can view income in their org" ON transactions_income;
CREATE POLICY "Users can view income in their org"
  ON transactions_income FOR SELECT
  USING (organization_id = get_auth_org_id());

DROP POLICY IF EXISTS "Users can insert income in their org" ON transactions_income;
CREATE POLICY "Users can insert income in their org"
  ON transactions_income FOR INSERT
  WITH CHECK (organization_id = get_auth_org_id());

DROP POLICY IF EXISTS "Users can update income in their org" ON transactions_income;
CREATE POLICY "Users can update income in their org"
  ON transactions_income FOR UPDATE
  USING (organization_id = get_auth_org_id());

-- Gastos
DROP POLICY IF EXISTS "Users can view expense in their org" ON transactions_expense;
CREATE POLICY "Users can view expense in their org"
  ON transactions_expense FOR SELECT
  USING (organization_id = get_auth_org_id());

DROP POLICY IF EXISTS "Users can insert expense in their org" ON transactions_expense;
CREATE POLICY "Users can insert expense in their org"
  ON transactions_expense FOR INSERT
  WITH CHECK (organization_id = get_auth_org_id());

DROP POLICY IF EXISTS "Users can update expense in their org" ON transactions_expense;
CREATE POLICY "Users can update expense in their org"
  ON transactions_expense FOR UPDATE
  USING (organization_id = get_auth_org_id());

-- Bancos
DROP POLICY IF EXISTS "Users can view bank accounts in their org" ON bank_accounts;
CREATE POLICY "Users can view bank accounts in their org"
  ON bank_accounts FOR SELECT
  USING (organization_id = get_auth_org_id());

-- Inventario / Activos
DROP POLICY IF EXISTS "Users can view inventory in their org" ON inventory_items;
CREATE POLICY "Users can view inventory in their org"
  ON inventory_items FOR SELECT
  USING (organization_id = get_auth_org_id());

DROP POLICY IF EXISTS "Users can insert inventory in their org" ON inventory_items;
CREATE POLICY "Users can insert inventory in their org"
  ON inventory_items FOR INSERT
  WITH CHECK (organization_id = get_auth_org_id());

DROP POLICY IF EXISTS "Users can update inventory in their org" ON inventory_items;
CREATE POLICY "Users can update inventory in their org"
  ON inventory_items FOR UPDATE
  USING (organization_id = get_auth_org_id());

-- 3. Crear Vistas de Soft Delete (Lectura automática filtrada)
-- Ingresos Activos
CREATE OR REPLACE VIEW active_income AS
  SELECT * FROM transactions_income
  WHERE deleted_at IS NULL;

-- Gastos Activos
CREATE OR REPLACE VIEW active_expense AS
  SELECT * FROM transactions_expense
  WHERE deleted_at IS NULL;

-- Activos (Inventario) Activos
CREATE OR REPLACE VIEW active_inventory AS
  SELECT * FROM inventory_items
  WHERE deleted_at IS NULL;
