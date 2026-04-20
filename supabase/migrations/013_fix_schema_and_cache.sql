-- ETHOS v2.0 - Migration 010: Deep Audit & Schema Fix
-- This migration addresses persistent schema cache issues and data inconsistencies.
-- 1. Ensure 'payment_method' exists in transactions_expense
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
-- 2. Ensure 'payment_method' exists in transactions_income
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
-- 3. Normalize 'transaction_type' in bank_transactions to lowercase
-- This fixes the issue where 'Income' vs 'income' caused totals to be zero.
UPDATE public.bank_transactions
SET transaction_type = LOWER(transaction_type)
WHERE transaction_type != LOWER(transaction_type);
-- 4. Force Schema Cache Reload
-- This is critical for PostgREST to recognize the new columns immediately.
NOTIFY pgrst,
'reload schema';