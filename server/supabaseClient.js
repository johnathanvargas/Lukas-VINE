const { createClient } = require('@supabase/supabase-js')

// Server-side Supabase client
// Prefer SUPABASE_SERVICE_ROLE_KEY for server operations (has elevated privileges).
// If SERVICE_ROLE is not set, fall back to SUPABASE_ANON_KEY (less privileged).
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL in environment variables')
}

const keyToUse = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY

if (!keyToUse) {
  console.error('Missing Supabase key. Set SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY in your server environment.')
  throw new Error('Supabase configuration incomplete')
}

const supabase = createClient(SUPABASE_URL, keyToUse)

module.exports = supabase
