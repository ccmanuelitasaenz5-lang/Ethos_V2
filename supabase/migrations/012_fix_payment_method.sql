-- ETHOS v2.0 - Migration 009: Fix Schema Inconsistencies
-- Ensures missing columns like 'payment_method' are present in the database.
-- 1. Fix transactions_income
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'transactions_income'
        AND column_name = 'payment_method'
) THEN
ALTER TABLE public.transactions_income
ADD COLUMN payment_method TEXT CHECK (
        payment_method IN (
            'efectivo',
            'transferencia',
            'pago_movil',
            'cheque',
            'tarjeta'
        )
    );
END IF;
END $$;
-- 2. Fix transactions_expense
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'transactions_expense'
        AND column_name = 'payment_method'
) THEN
ALTER TABLE public.transactions_expense
ADD COLUMN payment_method TEXT CHECK (
        payment_method IN (
            'efectivo',
            'transferencia',
            'pago_movil',
            'cheque',
            'tarjeta'
        )
    );
END IF;
END $$;
-- Refresh PostgREST cache (optional, happens automatically usually, but good practice to mention)
-- NOTIFY pgrst, 'reload schema';