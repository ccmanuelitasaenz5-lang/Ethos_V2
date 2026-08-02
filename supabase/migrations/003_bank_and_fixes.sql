-- ETHOS v2.0 - Migration 003: Bank Module and Schema Fixes
-- This script ensures consistent schema and adds the Bank module.

-- 0. Helper Functions (if not already defined in previous migrations)
CREATE OR REPLACE FUNCTION public.get_auth_organization()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT organization_id FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Ensure 'created_by' exists in transactions tables


DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions_expense' AND column_name = 'created_by') THEN
        ALTER TABLE public.transactions_expense ADD COLUMN created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions_income' AND column_name = 'created_by') THEN
        ALTER TABLE public.transactions_income ADD COLUMN created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Create bank_accounts table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    account_name TEXT NOT NULL,         -- Ej: 'Banco Mercantil - 1234'
    account_number TEXT,                -- Opcional: últimos 4 dígitos
    bank_name TEXT,                     -- Ej: 'Mercantil'
    currency TEXT DEFAULT 'VES',        -- 'VES' o 'USD'
    accounting_account_id UUID, -- Vínculo con el Plan de Cuentas (UUID) (FK added later)
    initial_balance DECIMAL(15,2) DEFAULT 0.00,
    current_balance DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create bank_transactions table
CREATE TABLE IF NOT EXISTS public.bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reference TEXT,                     -- Número de referencia bancaria
    description TEXT NOT NULL,          -- Descripción del movimiento
    amount DECIMAL(15,2) NOT NULL,      -- Positivo para ingresos, negativo para egresos
    transaction_type TEXT CHECK (transaction_type IN ('income', 'expense', 'fee', 'transfer')),
    is_reconciled BOOLEAN DEFAULT FALSE,
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL, -- Referencia para conciliación
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- 5. Policies for bank_accounts
DROP POLICY IF EXISTS bank_accounts_view_self ON public.bank_accounts;
CREATE POLICY bank_accounts_view_self ON public.bank_accounts
FOR SELECT USING (organization_id = get_auth_organization());

DROP POLICY IF EXISTS bank_accounts_manage_admin ON public.bank_accounts;
CREATE POLICY bank_accounts_manage_admin ON public.bank_accounts
FOR ALL USING (organization_id = get_auth_organization() AND get_auth_role() = 'admin');

DROP POLICY IF EXISTS bank_accounts_insert_admin ON public.bank_accounts;
CREATE POLICY bank_accounts_insert_admin ON public.bank_accounts
FOR INSERT WITH CHECK (organization_id = get_auth_organization() AND get_auth_role() = 'admin');

-- 6. Policies for bank_transactions
DROP POLICY IF EXISTS bank_transactions_view_self ON public.bank_transactions;
CREATE POLICY bank_transactions_view_self ON public.bank_transactions
FOR SELECT USING (organization_id = get_auth_organization());

DROP POLICY IF EXISTS bank_transactions_manage_admin ON public.bank_transactions;
CREATE POLICY bank_transactions_manage_admin ON public.bank_transactions
FOR ALL USING (organization_id = get_auth_organization() AND get_auth_role() = 'admin');

DROP POLICY IF EXISTS bank_transactions_insert_admin ON public.bank_transactions;
CREATE POLICY bank_transactions_insert_admin ON public.bank_transactions
FOR INSERT WITH CHECK (organization_id = get_auth_organization() AND get_auth_role() = 'admin');

-- 7. Triggers for updated_at
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_transactions_updated_at BEFORE UPDATE ON bank_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
