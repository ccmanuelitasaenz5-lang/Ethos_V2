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

async function cleanDatabase() {
  console.log("Iniciando limpieza de la base de datos...");
  
  // Borrar en orden para evitar problemas de claves foráneas
  console.log("Borrando transacciones bancarias...");
  await adminSupabase.from('bank_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Borrando partidas contables...");
  await adminSupabase.from('accounting_entry_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Borrando asientos contables...");
  await adminSupabase.from('accounting_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Borrando ingresos...");
  await adminSupabase.from('transactions_income').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Borrando gastos...");
  await adminSupabase.from('transactions_expense').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log("Borrando cuentas bancarias (y reseteando saldos)...");
  await adminSupabase.from('bank_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log("¡Limpieza completada! La base de datos está lista para pruebas en limpio.");
}

cleanDatabase().catch(console.error);
