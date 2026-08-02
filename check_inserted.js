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
  const { data, error } = await supabase
      .from("bank_transactions")
      .select("*")
      .eq("organization_id", orgId);
      
  console.log("Tx:", data, "Error:", error);
}

run().catch(console.error);
