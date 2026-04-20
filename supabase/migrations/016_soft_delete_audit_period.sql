-- =====================================================
-- 012: Soft Delete + Audit Log + Bloqueo de Período
-- =====================================================
 
-- 1. Agregar columna deleted_at a transacciones
ALTER TABLE transactions_income
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users ON DELETE SET NULL;
 
ALTER TABLE transactions_expense
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users ON DELETE SET NULL;
 
-- 2. Tabla de períodos contables
CREATE TABLE IF NOT EXISTS accounting_periods (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations ON DELETE CASCADE NOT NULL,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  status      TEXT CHECK (status IN ('open','closed')) DEFAULT 'open',
  closed_at   TIMESTAMPTZ,
  closed_by   UUID REFERENCES users ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, year, month)
);
 
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
 
CREATE POLICY "Users can view periods in their org"
  ON accounting_periods FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));
 
CREATE POLICY "Admins can manage periods"
  ON accounting_periods FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM users
    WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users
    WHERE id = auth.uid() AND role = 'admin'
  ));
 
-- 3. Tabla de audit log
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations ON DELETE CASCADE,
  user_id       UUID REFERENCES users ON DELETE SET NULL,
  action        TEXT NOT NULL,   -- 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE'
  table_name    TEXT NOT NULL,
  record_id     UUID NOT NULL,
  old_data      JSONB,
  new_data      JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
 
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
 
-- Audit log: solo lectura para admins/auditores, nadie puede modificar
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users
    WHERE id = auth.uid() AND role IN ('admin','auditor')
  ));
 
-- Índices
CREATE INDEX idx_audit_logs_org      ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_record   ON audit_logs(table_name, record_id);
CREATE INDEX idx_periods_org         ON accounting_periods(organization_id, year, month);
CREATE INDEX idx_income_deleted      ON transactions_income(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expense_deleted     ON transactions_expense(organization_id) WHERE deleted_at IS NULL;
 
-- 4. Función para verificar si un período está cerrado
CREATE OR REPLACE FUNCTION is_period_closed(
  p_organization_id UUID,
  p_date DATE
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE organization_id = p_organization_id
      AND year  = EXTRACT(YEAR  FROM p_date)::INTEGER
      AND month = EXTRACT(MONTH FROM p_date)::INTEGER
      AND status = 'closed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
