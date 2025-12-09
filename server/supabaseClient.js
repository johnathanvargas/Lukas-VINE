const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// For server-side admin actions, you MUST use the service role key.
// Fail fast if either is missing to avoid silently using an incomplete configuration.
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables')
  throw new Error('Supabase server configuration is incomplete. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
}

// Create an admin client that bypasses RLS for server-side operations.
// Do NOT export or expose this key to any client-side code or public endpoints.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  // Server-side: don't persist sessions
  auth: { persistSession: false }
})

module.exports = supabaseAdmin
