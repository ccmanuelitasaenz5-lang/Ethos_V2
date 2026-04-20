-- ETHOS v2.0 - Migration 004: Bank Account Balance Triggers
-- Automatically updates bank_accounts.current_balance when transactions change

-- 1. Function to handle balance updates
CREATE OR REPLACE FUNCTION public.handle_bank_transaction_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.bank_accounts
        SET current_balance = current_balance + NEW.amount,
            updated_at = NOW()
        WHERE id = NEW.bank_account_id;
        RETURN NEW;

    -- Handle DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.bank_accounts
        SET current_balance = current_balance - OLD.amount,
            updated_at = NOW()
        WHERE id = OLD.bank_account_id;
        RETURN OLD;

    -- Handle UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        -- If bank_account_id changed (rare but possible), handle both accounts
        IF (OLD.bank_account_id <> NEW.bank_account_id) THEN
            -- Revert from old account
            UPDATE public.bank_accounts
            SET current_balance = current_balance - OLD.amount,
                updated_at = NOW()
            WHERE id = OLD.bank_account_id;

            -- Apply to new account
            UPDATE public.bank_accounts
            SET current_balance = current_balance + NEW.amount,
                updated_at = NOW()
            WHERE id = NEW.bank_account_id;
        ELSE
            -- Same account, just update difference
            UPDATE public.bank_accounts
            SET current_balance = current_balance - OLD.amount + NEW.amount,
                updated_at = NOW()
            WHERE id = NEW.bank_account_id;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS update_bank_balance_trigger ON public.bank_transactions;

CREATE TRIGGER update_bank_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.bank_transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_bank_transaction_balance();

-- 3. Trigger for updating current_balance when initial_balance changes
CREATE OR REPLACE FUNCTION public.handle_bank_account_initial_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.initial_balance <> NEW.initial_balance) THEN
        NEW.current_balance = NEW.current_balance + (NEW.initial_balance - OLD.initial_balance);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_initial_balance_trigger ON public.bank_accounts;

CREATE TRIGGER update_initial_balance_trigger
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.handle_bank_account_initial_balance();

-- 4. Recalculate balances to ensure consistency with existing data
DO $$
DECLARE
    account RECORD;
    real_balance DECIMAL(15,2);
BEGIN
    FOR account IN SELECT * FROM public.bank_accounts LOOP
        -- Calculate sum of all transactions
        SELECT COALESCE(SUM(amount), 0) INTO real_balance
        FROM public.bank_transactions
        WHERE bank_account_id = account.id;

        -- Update the account with initial_balance + transaction_sum
        UPDATE public.bank_accounts
        SET current_balance = account.initial_balance + real_balance
        WHERE id = account.id;
    END LOOP;
END $$;
