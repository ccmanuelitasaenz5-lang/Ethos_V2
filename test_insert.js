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

const supabase = createClient(envVars['NEXT_PUBLIC_SUPABASE_URL'], envVars['SUPABASE_SERVICE_ROLE_KEY']);

async function run() {
  const orgId = 'df6c188a-de30-445e-90c5-88d8e3947680';
  const bankAccountId = 'fc414566-8587-4bec-903c-0bcb961e7fc5';
  const incomeId = 'b6e2a626-2bba-4661-a2b4-d0516815b0d1';
  
  const { data, error } = await supabase
      .from("bank_transactions")
      .insert({
        organization_id: orgId,
        bank_account_id: bankAccountId,
        date: '2026-05-19',
        description: `Ingreso test`,
        amount: 500,
        transaction_type: "income",
        reference: null,
        reference_id: incomeId,
        reference_type: 'income',
        // created_by: 'some-user-id'
      });
      
  console.log("Insert result:", data, "Error:", error);
}

run().catch(console.error);
