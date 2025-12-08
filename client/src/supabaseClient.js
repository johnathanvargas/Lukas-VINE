/**
 * Supabase Client Configuration
 * 
 * This file exports a configured Supabase client for use in React components.
 * Uses the anon key which respects Row Level Security (RLS) policies.
 * 
 * Environment Variables Required:
 * - REACT_APP_SUPABASE_URL: Your Supabase project URL
 * - REACT_APP_SUPABASE_ANON_KEY: Anon/public key (safe for client-side)
 * 
 * IMPORTANT: Never use the service_role key in client-side code!
 */

import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!');
  console.error('Required: REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY');
  throw new Error('Supabase configuration is incomplete');
}

// Create and export Supabase client
// This client uses the anon key and respects RLS policies
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  return user;
};

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const user = await getCurrentUser();
  return !!user;
};
