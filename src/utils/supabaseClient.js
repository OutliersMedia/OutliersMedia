import { createClient } from '@supabase/supabase-js';

const VALID_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzaW93YmZuZ29iaHh5ZmVrbGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0OTY4NjAsImV4cCI6MjEwNjA3Mjg2MH0.15zzzYgtSOaXKvvREGVI3E5CI3zcaadVigHHmzp6ivs';

const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Standard Supabase project anon keys start with "ey" (JWT format).
// If an invalid or non-JWT key (like sb_publishable_...) is set in environment, fall back to the working key.
const supabaseAnonKey = (envKey && envKey.startsWith('ey')) ? envKey : VALID_ANON_KEY;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hsiowbfngobhxyfekldl.supabase.co';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});
