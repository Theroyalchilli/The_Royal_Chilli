import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY is not set. The POS server needs the service_role key ' +
    '(not the anon key) so RLS policies meant for the public website do not block staff/POS operations. ' +
    'Get it from Supabase → Project Settings → API → service_role, and add it to .env.local.'
  )
}

// Server-only client. Never import this file from client components —
// the service_role key bypasses RLS and must not reach the browser.
export const supabase = createClient(supabaseUrl, serviceRoleKey)
export default supabase
