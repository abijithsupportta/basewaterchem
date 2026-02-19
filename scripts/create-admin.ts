/**
 * Script to create the superadmin account in Supabase Auth
 * and insert the corresponding staff record.
 *
 * Usage: npx tsx scripts/create-admin.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminEmail = process.env.ADMIN_EMAIL || 'basechemical21@gmail.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`Creating superadmin account: ${adminEmail}`);

  // 1. Create auth user via Admin API
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true, // auto-confirm the email
    user_metadata: { full_name: 'Super Admin', role: 'admin' },
  });

  if (authError) {
    // If user already exists, try to fetch them
    if (authError.message?.includes('already been registered') || authError.status === 422) {
      console.log('Auth user already exists. Fetching existing user...');
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find((u) => u.email === adminEmail);
      if (!existing) {
        console.error('Could not find existing user');
        process.exit(1);
      }
      console.log(`Found existing auth user: ${existing.id}`);
      await ensureStaffRecord(existing.id);
      return;
    }
    console.error('Failed to create auth user:', authError.message);
    process.exit(1);
  }

  console.log(`Auth user created: ${authData.user.id}`);

  // 2. Insert staff record
  await ensureStaffRecord(authData.user.id);
}

async function ensureStaffRecord(authUserId: string) {
  // Check if staff record already exists
  const { data: existingStaff } = await supabase
    .from('staff')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single();

  if (existingStaff) {
    console.log('Staff record already exists. Done!');
    return;
  }

  const { error: staffError } = await supabase.from('staff').insert({
    auth_user_id: authUserId,
    full_name: 'Super Admin',
    email: adminEmail,
    phone: '',
    role: 'admin',
    is_active: true,
  });

  if (staffError) {
    console.error('Failed to create staff record:', staffError.message);
    console.log('Note: Make sure migrations have been run on Supabase first.');
    process.exit(1);
  }

  console.log('Staff record created with role: admin');
  console.log('\n✅ Superadmin account ready!');
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
