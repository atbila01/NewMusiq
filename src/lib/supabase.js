import { createClient } from '@supabase/supabase-js';
import { safeStorage } from './safeStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use Supabase.');
}

// Custom no-op lock to prevent Supabase auth-js from accessing window.localStorage for multi-tab locks in sandboxed environments
const noopLock = async (name, acquireTimeout, fn) => {
  return await fn();
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    storage: safeStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: noopLock
  }
});
