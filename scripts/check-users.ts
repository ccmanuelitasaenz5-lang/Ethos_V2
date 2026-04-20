
import { createClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'
import * as path from 'path'

loadEnvConfig(path.resolve(__dirname, '../'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkUsers() {
  console.log('--- Checking auth.users ---')
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
  
  if (authError) {
    console.error('Error fetching auth users:', authError.message)
  } else {
    console.log(`Found ${authUsers.users.length} users in auth.users`)
    authUsers.users.forEach(u => {
      console.log(`- Email: ${u.email}, ID: ${u.id}, Confirmed: ${u.email_confirmed_at ? 'Yes' : 'No'}`)
    })
  }

  console.log('\n--- Checking public.users ---')
  const { data: publicUsers, error: publicError } = await supabase
    .from('users')
    .select('id, full_name, role, organization_id')

  if (publicError) {
    console.error('Error fetching public users:', publicError.message)
  } else {
    console.log(`Found ${publicUsers.length} users in public.users`)
    publicUsers.forEach(u => {
      console.log(`- Name: ${u.full_name}, ID: ${u.id}, OrgID: ${u.organization_id}, Role: ${u.role}`)
    })
  }
}

checkUsers()
