const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
    let [key, ...valParts] = line.split('=');
    if (key && valParts.length > 0) {
        let val = valParts.join('=').trim().replace(/^['"]|['"]$/g, '');
        envVars[key.trim()] = val;
    }
});

const supabase = createClient(envVars['NEXT_PUBLIC_SUPABASE_URL'], envVars['SUPABASE_SERVICE_ROLE_KEY']);

async function check() {
  const { data: orgs } = await supabase.from('organizations').select('id, name');
  console.log("Organizations:");
  console.table(orgs);
  
  const { data: incomes } = await supabase
    .from('transactions_income')
    .select('id, concept, amount_usd, status, bank_account, organization_id')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log("Recent incomes:");
  console.table(incomes);
  
  const { data: banks } = await supabase
    .from('bank_accounts')
    .select('id, name, accounting_code, organization_id');
    
  console.log("Banks:");
  console.table(banks);
}

check().catch(console.error);
