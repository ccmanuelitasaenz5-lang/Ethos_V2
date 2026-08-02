-- ETHOS v2.0 Database Schema
-- Sistema de Contabilidad para OSFL Venezolanas

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA: organizations
-- Organizaciones (condominios, comunidades)
-- =====================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rif TEXT UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: users
-- Usuarios del sistema vinculados a organizaciones
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations ON DELETE CASCADE,
  role TEXT CHECK (role IN ('admin', 'auditor', 'resident')) NOT NULL DEFAULT 'resident',
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: transactions_income
-- Registro de ingresos (recibos)
-- =====================================================
CREATE TABLE transactions_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  receipt_number TEXT,
  concept TEXT NOT NULL,
  amount_usd DECIMAL(12,2),
  amount_ves DECIMAL(12,2),
  exchange_rate DECIMAL(10,4),
  account_code TEXT,
  payment_method TEXT CHECK (payment_method IN ('efectivo', 'transferencia', 'pago_movil', 'cheque', 'tarjeta')),
  created_by UUID REFERENCES users ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: transactions_expense
-- Registro de gastos (egresos)
-- =====================================================
CREATE TABLE transactions_expense (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  invoice_number TEXT,
  supplier TEXT NOT NULL,
  concept TEXT NOT NULL,
  amount_usd DECIMAL(12,2),
  amount_ves DECIMAL(12,2),
  exchange_rate DECIMAL(10,4),
  subtotal DECIMAL(12,2),
  iva_amount DECIMAL(12,2),
  iva_percentage DECIMAL(5,2) DEFAULT 16.00,
  retention_iva DECIMAL(12,2),
  retention_islr DECIMAL(12,2),
  category TEXT,
  payment_method TEXT CHECK (payment_method IN ('efectivo', 'transferencia', 'pago_movil', 'cheque', 'tarjeta')),
  created_by UUID REFERENCES users ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: assets
-- Inventario de activos fijos
-- =====================================================
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  cost_usd DECIMAL(12,2),
  cost_ves DECIMAL(12,2),
  useful_life_months INTEGER,
  depreciation_monthly DECIMAL(12,2),
  accumulated_depreciation DECIMAL(12,2) DEFAULT 0,
  location TEXT,
  purchase_date DATE,
  status TEXT CHECK (status IN ('active', 'inactive', 'disposed')) DEFAULT 'active',
  created_by UUID REFERENCES users ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: journal_entries
-- Libro Diario y Libro Mayor (Partida Doble)
-- =====================================================
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  entry_number INTEGER,
  description TEXT NOT NULL,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  debit DECIMAL(12,2) DEFAULT 0,
  credit DECIMAL(12,2) DEFAULT 0,
  reference_id UUID,
  reference_type TEXT CHECK (reference_type IN ('income', 'expense', 'manual')),
  created_by UUID REFERENCES users ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: documents
-- Expediente digital (documentos y archivos)
-- =====================================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES users ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES: organizations
-- =====================================================
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- POLICIES: users
-- =====================================================
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage users in their organization"
  ON users FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- POLICIES: transactions_income
-- =====================================================
CREATE POLICY "Users can view income in their organization"
  ON transactions_income FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can insert income"
  ON transactions_income FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

CREATE POLICY "Admins can update income"
  ON transactions_income FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

CREATE POLICY "Admins can delete income"
  ON transactions_income FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

-- =====================================================
-- POLICIES: transactions_expense
-- =====================================================
CREATE POLICY "Users can view expenses in their organization"
  ON transactions_expense FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can insert expenses"
  ON transactions_expense FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

CREATE POLICY "Admins can update expenses"
  ON transactions_expense FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

CREATE POLICY "Admins can delete expenses"
  ON transactions_expense FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

-- =====================================================
-- POLICIES: assets
-- =====================================================
CREATE POLICY "Users can view assets in their organization"
  ON assets FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage assets"
  ON assets FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

-- =====================================================
-- POLICIES: documents
-- =====================================================
CREATE POLICY "Users can view documents in their organization"
  ON documents FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage documents"
  ON documents FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

-- =====================================================
-- POLICIES: journal_entries
-- =====================================================
CREATE POLICY "Users can view journal entries in their organization"
  ON journal_entries FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage journal entries"
  ON journal_entries FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

-- =====================================================
-- INDEXES para optimización
-- =====================================================
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_transactions_income_org ON transactions_income(organization_id);
CREATE INDEX idx_transactions_income_date ON transactions_income(date);
CREATE INDEX idx_transactions_expense_org ON transactions_expense(organization_id);
CREATE INDEX idx_transactions_expense_date ON transactions_expense(date);
CREATE INDEX idx_assets_org ON assets(organization_id);
CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_journal_entries_org_date ON journal_entries(organization_id, date);
CREATE INDEX idx_journal_entries_account ON journal_entries(account_code);

-- =====================================================
-- TRIGGERS para updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_income_updated_at BEFORE UPDATE ON transactions_income
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_expense_updated_at BEFORE UPDATE ON transactions_expense
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
