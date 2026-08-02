-- ETHOS v2.0 - Migration 023: Accounting Structure Refactor
-- Refactoriza journal_entries (plana) a accounting_entries (maestro-detalle)
-- Mantiene compatibilidad mediante una vista.

BEGIN;

-- 1. Renombrar tabla antigua para respaldo
ALTER TABLE IF EXISTS public.journal_entries RENAME TO journal_entries_legacy;

-- 2. Crear tabla maestra: accounting_entries
CREATE TABLE public.accounting_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    entry_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    status TEXT CHECK (status IN ('draft', 'posted')) DEFAULT 'posted',
    reference_id UUID,
    reference_type TEXT CHECK (reference_type IN ('income', 'expense', 'manual')),
    created_by UUID REFERENCES users ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Asegurar número único por organización
    UNIQUE (organization_id, entry_number)
);

-- 3. Crear tabla detalle: accounting_entry_items
CREATE TABLE public.accounting_entry_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES accounting_entries ON DELETE CASCADE NOT NULL,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    description TEXT, -- Descripción específica por renglón
    debit DECIMAL(19, 4) DEFAULT 0,
    credit DECIMAL(19, 4) DEFAULT 0,
    debit_ves DECIMAL(19, 4) DEFAULT 0,
    credit_ves DECIMAL(19, 4) DEFAULT 0,
    amount_usd DECIMAL(19, 4), -- Monto neto en USD
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Crear vista plana para compatibilidad y reportes: view_journal_flat
CREATE OR REPLACE VIEW public.view_journal_flat AS
SELECT 
    e.id as entry_id,
    e.organization_id,
    e.date,
    e.entry_number,
    e.description as entry_description,
    e.status,
    e.reference_id,
    e.reference_type,
    i.id as item_id,
    i.account_code,
    i.account_name,
    i.description as item_description,
    i.debit,
    i.credit,
    i.debit_ves,
    i.credit_ves,
    i.amount_usd,
    e.created_at,
    e.created_by
FROM public.accounting_entries e
JOIN public.accounting_entry_items i ON e.id = i.entry_id;

-- 5. Re-crear vista journal_entries para compatibilidad con código antiguo
CREATE OR REPLACE VIEW public.journal_entries AS
SELECT 
    item_id as id,
    organization_id,
    date,
    entry_number,
    entry_description as description,
    account_code,
    account_name,
    debit,
    credit,
    reference_id,
    reference_type,
    created_by,
    created_at,
    debit_ves,
    credit_ves
FROM public.view_journal_flat;

-- 6. Migrar datos existentes de journal_entries_legacy
-- Nota: Como la tabla vieja era plana, cada fila se convertirá en un asiento con UN solo renglón.
-- Esto no es ideal pero mantiene la integridad de los datos históricos.
DO $$
DECLARE
    legacy_rec RECORD;
    new_entry_id UUID;
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'journal_entries_legacy') THEN
        FOR legacy_rec IN SELECT * FROM journal_entries_legacy LOOP
            -- Insertar cabecera
            INSERT INTO public.accounting_entries (
                organization_id, date, entry_number, description, reference_id, reference_type, created_by, created_at
            ) VALUES (
                legacy_rec.organization_id, legacy_rec.date, legacy_rec.entry_number, legacy_rec.description, 
                legacy_rec.reference_id, legacy_rec.reference_type, legacy_rec.created_by, legacy_rec.created_at
            ) RETURNING id INTO new_entry_id;

            -- Insertar detalle
            INSERT INTO public.accounting_entry_items (
                entry_id, account_code, account_name, debit, credit, debit_ves, credit_ves, amount_usd
            ) VALUES (
                new_entry_id, legacy_rec.account_code, legacy_rec.account_name, 
                legacy_rec.debit, legacy_rec.credit, 
                COALESCE(legacy_rec.debit_ves, 0), COALESCE(legacy_rec.credit_ves, 0),
                (COALESCE(legacy_rec.debit, 0) - COALESCE(legacy_rec.credit, 0))
            );
        END LOOP;
    END IF;
END $$;

-- 7. Configurar RLS para las nuevas tablas
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entry_items ENABLE ROW LEVEL SECURITY;

-- Función helper para RLS si no existe (ya existe en 019 pero por seguridad)
CREATE OR REPLACE FUNCTION get_auth_org_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'organization_id')::UUID;
$$ LANGUAGE sql STABLE;

CREATE POLICY "Users can view entries in their org"
  ON public.accounting_entries FOR SELECT
  USING (organization_id = get_auth_org_id());

CREATE POLICY "Users can insert entries in their org"
  ON public.accounting_entries FOR INSERT
  WITH CHECK (organization_id = get_auth_org_id());

CREATE POLICY "Users can update entries in their org"
  ON public.accounting_entries FOR UPDATE
  USING (organization_id = get_auth_org_id());

CREATE POLICY "Users can delete entries in their org"
  ON public.accounting_entries FOR DELETE
  USING (organization_id = get_auth_org_id());

-- RLS para items (basado en la cabecera)
CREATE POLICY "Users can view entry items in their org"
  ON public.accounting_entry_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.accounting_entries 
      WHERE id = entry_id AND organization_id = get_auth_org_id()
    )
  );

CREATE POLICY "Users can manage entry items in their org"
  ON public.accounting_entry_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.accounting_entries 
      WHERE id = entry_id AND organization_id = get_auth_org_id()
    )
  );

-- 8. Índices
CREATE INDEX idx_accounting_entries_org ON public.accounting_entries(organization_id);
CREATE INDEX idx_accounting_entries_date ON public.accounting_entries(date);
CREATE INDEX idx_accounting_items_entry ON public.accounting_entry_items(entry_id);
CREATE INDEX idx_accounting_items_code ON public.accounting_entry_items(account_code);

COMMIT;
