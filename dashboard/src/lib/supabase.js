// supabase.js — browser-side Supabase client
// Uses the ANON key (safe to expose in a browser — RLS controls access).

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY.\n' +
    'Create a .env file in the dashboard/ folder with these values.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
