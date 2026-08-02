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

async function testPost(incomeId) {
  const { data: income, error: fetchError } = await adminSupabase
    .from("transactions_income")
    .select("*")
    .eq("id", incomeId)
    .single();

  if (fetchError || !income) return { error: "Ingreso no encontrado" };
  
  const incomeAccount = income.account_code || "4.1"; 
  let paymentAccount = "1.1.01"; 
  let bankAccountId = null;

  if (income.bank_account) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(income.bank_account);
    if (isUUID) {
      console.log("Is UUID");
    } else {
      paymentAccount = income.bank_account;
      const { data: bank } = await adminSupabase
        .from("bank_accounts")
        .select("id")
        .eq("accounting_code", income.bank_account)
        .eq("organization_id", income.organization_id)
        .maybeSingle();
        
      console.log("Lookup result for", income.bank_account, "Org:", income.organization_id, "=>", bank);
      bankAccountId = bank?.id || null;
    }
  }
  
  console.log("Final bankAccountId:", bankAccountId);
}

testPost('b6e2a626-2bba-4661-a2b4-d0516815b0d1').catch(console.error);
