-- ETHOS v2.0 - Migration 005: Monthly Closing Module
-- Ensures accounting integrity by locking periods.

-- 1. Create monthly_closings table
CREATE TABLE IF NOT EXISTS public.monthly_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    period DATE NOT NULL, -- Stored as the first day of the month (e.g., 2023-01-01)
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('closed', 'reopened')) DEFAULT 'closed',
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- Store snapshot data or report URLs
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, period)
);

-- 2. Enable RLS
ALTER TABLE public.monthly_closings ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Users can view closings to know if they can edit
DROP POLICY IF EXISTS monthly_closings_view_org ON public.monthly_closings;
CREATE POLICY monthly_closings_view_org ON public.monthly_closings
    FOR SELECT USING (organization_id = get_auth_organization());

-- Only Admins can manage closings
DROP POLICY IF EXISTS monthly_closings_manage_admin ON public.monthly_closings;
CREATE POLICY monthly_closings_manage_admin ON public.monthly_closings
    FOR ALL USING (organization_id = get_auth_organization() AND get_auth_role() = 'admin');

-- 4. Function to check if a date is in a closed period
CREATE OR REPLACE FUNCTION public.check_period_is_open()
RETURNS TRIGGER AS $$
DECLARE
    is_closed BOOLEAN;
BEGIN
    -- 1. Check OLD record (for UPDATE and DELETE)
    -- Prevents modifying or deleting records that belong to a closed period
    IF (TG_OP IN ('UPDATE', 'DELETE')) THEN
        SELECT EXISTS (
            SELECT 1 FROM public.monthly_closings
            WHERE organization_id = OLD.organization_id
            AND period = date_trunc('month', OLD.date)::DATE
            AND status = 'closed'
        ) INTO is_closed;

        IF is_closed THEN
            RAISE EXCEPTION 'Operación rechazada: El periodo % está cerrado.', to_char(OLD.date, 'YYYY-MM');
        END IF;
    END IF;

    -- 2. Check NEW record (for INSERT and UPDATE)
    -- Prevents inserting into or moving records to a closed period
    IF (TG_OP IN ('INSERT', 'UPDATE')) THEN
        SELECT EXISTS (
            SELECT 1 FROM public.monthly_closings
            WHERE organization_id = NEW.organization_id
            AND period = date_trunc('month', NEW.date)::DATE
            AND status = 'closed'
        ) INTO is_closed;

        IF is_closed THEN
            RAISE EXCEPTION 'Operación rechazada: El periodo % está cerrado.', to_char(NEW.date, 'YYYY-MM');
        END IF;
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Apply triggers to critical tables

-- Transactions Income
DROP TRIGGER IF EXISTS check_period_closed_income ON public.transactions_income;
CREATE TRIGGER check_period_closed_income
    BEFORE INSERT OR UPDATE OR DELETE ON public.transactions_income
    FOR EACH ROW EXECUTE FUNCTION public.check_period_is_open();

-- Transactions Expense
DROP TRIGGER IF EXISTS check_period_closed_expense ON public.transactions_expense;
CREATE TRIGGER check_period_closed_expense
    BEFORE INSERT OR UPDATE OR DELETE ON public.transactions_expense
    FOR EACH ROW EXECUTE FUNCTION public.check_period_is_open();

-- Journal Entries
DROP TRIGGER IF EXISTS check_period_closed_journal ON public.journal_entries;
CREATE TRIGGER check_period_closed_journal
    BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
    FOR EACH ROW EXECUTE FUNCTION public.check_period_is_open();

-- Bank Transactions
DROP TRIGGER IF EXISTS check_period_closed_bank ON public.bank_transactions;
CREATE TRIGGER check_period_closed_bank
    BEFORE INSERT OR UPDATE OR DELETE ON public.bank_transactions
    FOR EACH ROW EXECUTE FUNCTION public.check_period_is_open();

-- 6. Trigger for updated_at on monthly_closings
DROP TRIGGER IF EXISTS update_monthly_closings_updated_at ON public.monthly_closings;
CREATE TRIGGER update_monthly_closings_updated_at
    BEFORE UPDATE ON public.monthly_closings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
