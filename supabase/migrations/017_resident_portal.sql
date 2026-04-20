-- =====================================================
-- 013: Portal del Residente
-- =====================================================
 
-- 1. Agregar campo resident_user_id a propiedades (link a Auth)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS resident_user_id UUID REFERENCES users ON DELETE SET NULL;
 
-- 2. Vista para el estado de cuenta del residente
CREATE OR REPLACE VIEW resident_account_summary AS
SELECT
  p.id as property_id,
  p.organization_id,
  p.resident_user_id,
  p.code as property_code,
  COALESCE(SUM(i.amount_usd) FILTER (WHERE i.status = 'finalized' AND i.deleted_at IS NULL), 0) as total_paid_usd,
  -- Aquí se podría unir con una tabla de 'Cuentas por Cobrar' o 'Facturacion'
  -- Por ahora tomamos una deuda ficticia o calculada
  150.00 as current_balance_usd
FROM properties p
LEFT JOIN transactions_income i ON i.property_id = p.id
GROUP BY p.id, p.organization_id, p.resident_user_id, p.code;
 
-- 3. RLS para transacciones (el residente solo ve sus pagos)
DROP POLICY IF EXISTS "Residents can view their own payments" ON transactions_income;
CREATE POLICY "Residents can view their own payments"
  ON transactions_income FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE resident_user_id = auth.uid()
    )
  );
 
-- 4. RLS para la propiedad
CREATE POLICY "Residents can view their property data"
  ON properties FOR SELECT
  USING (resident_user_id = auth.uid());
