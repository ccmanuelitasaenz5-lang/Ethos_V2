-- ETHOS v2.0 - Migration 011: Bank Balance Automation
-- Automatically updates bank_accounts.current_balance when transactions change.
-- 1. Create Function to Calculate and Update Balance
CREATE OR REPLACE FUNCTION update_bank_account_balance() RETURNS TRIGGER AS $$
DECLARE target_account_id UUID;
new_balance DECIMAL(12, 2);
BEGIN -- Determine which account to update
IF (TG_OP = 'DELETE') THEN target_account_id := OLD.bank_account_id;
ELSE target_account_id := NEW.bank_account_id;
END IF;
-- Calculate the new balance based on ALL transactions for this account
-- We use the initial_balance + sum of all transactions
SELECT (b.initial_balance + COALESCE(SUM(t.amount), 0)) INTO new_balance
FROM public.bank_accounts b
    LEFT JOIN public.bank_transactions t ON b.id = t.bank_account_id
WHERE b.id = target_account_id
GROUP BY b.id;
-- Update the account with the new balance
UPDATE public.bank_accounts
SET current_balance = new_balance,
    updated_at = NOW()
WHERE id = target_account_id;
RETURN NULL;
-- Trigger is AFTER, return value matches doesn't matter much but NULL is standard for AFTER
END;
$$ LANGUAGE plpgsql;
-- 2. Create Trigger on bank_transactions
DROP TRIGGER IF EXISTS update_balance_trigger ON public.bank_transactions;
CREATE TRIGGER update_balance_trigger
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION update_bank_account_balance();
-- 3. Force Recalculation for existing accounts
-- This effectively "initializes" the correct balances right now.
DO $$
DECLARE acc RECORD;
BEGIN FOR acc IN
SELECT id
FROM public.bank_accounts LOOP -- Dummy update to fire the trigger? No, better to call the login directly or just run a manual update query.
    -- Let's run a manual update query to be safe and efficient.
UPDATE public.bank_accounts b
SET current_balance = (
        b.initial_balance + COALESCE(
            (
                SELECT SUM(amount)
                FROM public.bank_transactions t
                WHERE t.bank_account_id = b.id
            ),
            0
        )
    );
END LOOP;
END $$;