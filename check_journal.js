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
  const incomeId = 'b6e2a626-2bba-4661-a2b4-d0516815b0d1'; // Income #2
  
  const { data: entry } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('reference_id', incomeId)
    .single();
    
  console.log("Journal entry for Income #2:", entry);
}

run().catch(console.error);
