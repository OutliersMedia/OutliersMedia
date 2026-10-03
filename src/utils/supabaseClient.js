import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hsiowbfngobhxyfekldl.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzaW93YmZuZ29iaHh5ZmVrbGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0OTY4NjAsImV4cCI6MjEwNjA3Mjg2MH0.15zzzYgtSOaXKvvREGVI3E5CI3zcaadVigHHmzp6ivs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});
