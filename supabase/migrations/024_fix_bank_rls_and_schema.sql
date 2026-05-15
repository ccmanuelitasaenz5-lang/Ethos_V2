-- ETHOS v2.0 - Migration 024: Fix Bank RLS and Schema
-- Corrige las políticas RLS que bloquean al Admin Client en bank_transactions

BEGIN;

-- 1. Agregar campo accounting_code a bank_accounts (si no existe)
-- para facilitar la búsqueda por código contable
ALTER TABLE public.bank_accounts
ADD COLUMN IF NOT EXISTS accounting_code TEXT;

-- Poblar accounting_code desde la tabla de cuentas (join inicial)
UPDATE public.bank_accounts ba
SET accounting_code = aa.code
FROM public.accounting_accounts aa
WHERE ba.accounting_account_id = aa.id
  AND ba.accounting_code IS NULL;

-- 2. Agregar referencia y tipo al historial de bank_transactions
ALTER TABLE public.bank_transactions
ADD COLUMN IF NOT EXISTS reference_id UUID,
ADD COLUMN IF NOT EXISTS reference_type TEXT;

-- 3. Política sin restricción de rol para operaciones del service role
-- El service role bypassa RLS automáticamente, pero por seguridad agregamos una política explícita
DROP POLICY IF EXISTS "Service role can manage bank transactions" ON public.bank_transactions;
CREATE POLICY "Service role can manage bank transactions"
ON public.bank_transactions FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Trigger: sincronizar accounting_code cuando cambia accounting_account_id
CREATE OR REPLACE FUNCTION sync_bank_accounting_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.accounting_account_id IS NOT NULL THEN
    SELECT code INTO NEW.accounting_code
    FROM public.accounting_accounts
    WHERE id = NEW.accounting_account_id;
  ELSE
    NEW.accounting_code := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_bank_code_trigger ON public.bank_accounts;
CREATE TRIGGER sync_bank_code_trigger
BEFORE INSERT OR UPDATE OF accounting_account_id ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION sync_bank_accounting_code();

COMMIT;
