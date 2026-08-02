
DROP VIEW IF EXISTS public.journal_entries;
DROP VIEW IF EXISTS public.view_journal_flat;
CREATE OR REPLACE VIEW public.view_journal_flat AS
SELECT 
    e.id as entry_id,
    e.organization_id,
    e.date,
    e.entry_number,
    e.description as entry_description,
    e.description as description,
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
    a.main_type as account_type,
    e.created_at,
    e.created_by
FROM public.accounting_entries e
JOIN public.accounting_entry_items i ON e.id = i.entry_id
LEFT JOIN public.accounting_accounts a ON i.account_code = a.code AND e.organization_id = a.organization_id;

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
  
