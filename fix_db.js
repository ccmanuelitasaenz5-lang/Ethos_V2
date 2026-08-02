const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1].trim();
    let val = match[2].trim().replace(/^['"]|['"]$/g, '');
    envVars[key] = val;
  }
});

const adminSupabase = createClient(envVars['NEXT_PUBLIC_SUPABASE_URL'], envVars['SUPABASE_SERVICE_ROLE_KEY']);

async function fixData() {
  // 1. Delete my test insert (amount 500)
  await adminSupabase.from('bank_transactions').delete().eq('amount', 500).eq('description', 'Ingreso test');
  
  // 2. Insert the correct data for Income #2
  const incomeId = 'b6e2a626-2bba-4661-a2b4-d0516815b0d1';
  const { data: income } = await adminSupabase.from("transactions_income").select("*").eq("id", incomeId).single();
  const amountVES = income.amount_ves || (income.amount_usd * (income.exchange_rate || 1));
  const bankAccountId = 'fc414566-8587-4bec-903c-0bcb961e7fc5';
  
  const payload = {
        organization_id: income.organization_id,
        bank_account_id: bankAccountId,
        date: income.date,
        description: `Ingreso: ${income.concept} (Recibo: ${income.receipt_number || 'N/A'})`,
        amount: amountVES,           
        transaction_type: "income",  
        reference: income.receipt_number || null,
        reference_id: incomeId,
        reference_type: 'income',
        created_by: income.created_by
  };
  
  await adminSupabase.from("bank_transactions").insert(payload);
  console.log("Fixed successfully.");
}

fixData().catch(console.error);
