import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
