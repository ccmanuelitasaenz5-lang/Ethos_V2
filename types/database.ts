export interface Organization {
    id: string
    name: string
    rif: string | null
    address: string | null
    phone: string | null
    email: string | null
    entity_type: 'GE' | 'PYME'
    fiscal_printer_ip?: string | null
    digital_invoice_api_key?: string | null
    created_at: string
    updated_at: string
}

export interface User {
    id: string
    organization_id: string
    role: 'admin' | 'auditor' | 'resident'
    full_name: string
    created_at: string
    updated_at: string
}

export interface Property {
    id: string
    organization_id: string
    number: string
    owner_name: string | null
    aliquot: number
    balance: number
    created_at: string
    updated_at: string
}

export interface TransactionIncome {
    id: string
    organization_id: string
    property_id?: string | null
    date: string
    receipt_number: string | null
    control_number?: string | null
    concept: string
    amount_usd: number | null
    amount_ves: number | null
    exchange_rate: number | null
    account_code: string | null
    bank_account?: string | null
    payment_method: 'efectivo' | 'transferencia' | 'pago_movil' | 'cheque' | 'tarjeta' | null
    status: 'draft' | 'finalized' | 'annulled'
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface TransactionExpense {
    id: string
    organization_id: string
    date: string
    invoice_number: string | null
    control_number?: string | null
    supplier: string
    concept: string
    amount_usd: number | null
    amount_ves: number | null
    exchange_rate: number | null
    subtotal: number | null
    iva_amount: number | null
    iva_percentage: number
    retention_iva: number | null
    retention_islr: number | null
    igtf_apply: boolean
    igtf_amount: number
    category: string | null
    account_code?: string | null
    payment_account?: string | null
    payment_method: 'efectivo' | 'transferencia' | 'pago_movil' | 'cheque' | 'tarjeta' | null
    status: 'draft' | 'finalized' | 'annulled'
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface Asset {
    id: string
    organization_id: string
    name: string
    category: string | null
    cost_usd: number | null
    cost_ves: number | null
    useful_life_months: number | null
    depreciation_monthly: number | null
    accumulated_depreciation: number
    location: string | null
    purchase_date: string | null
    status: 'active' | 'inactive' | 'disposed'
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface Document {
    id: string
    organization_id: string
    title: string
    description: string | null
    file_url: string
    file_size: number | null
    mime_type: string | null
    uploaded_by: string | null
    uploaded_at: string
}

export interface TransactionAccount {
    id: string
    organization_id: string
    code: string
    name: string
    level: number
    main_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'
    is_movement: boolean
    parent_id: string | null
    created_at: string
    updated_at: string
}

export interface AccountingEntry {
    id: string
    organization_id: string
    date: string
    entry_number: number | null
    description: string
    reference_id: string | null
    reference_type: 'income' | 'expense' | 'manual' | null
    status: 'posted' | 'draft'
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface AccountingEntryItem {
    id: string
    entry_id: string
    account_code: string
    account_name: string
    description?: string | null
    debit: number
    credit: number
    debit_ves?: number
    credit_ves?: number
    amount_usd?: number | null
    created_at: string
}

// Para compatibilidad con vistas flat en reportes
export type JournalEntryFlat = AccountingEntry & AccountingEntryItem;

export interface DashboardStats {
    totalIncome: number
    totalIncomeVES?: number
    totalExpenses: number
    totalExpensesVES?: number
    balance: number
    balanceVES?: number
    transactionCount: number
    bankBalance: number
    bankBalanceVES?: number
}
