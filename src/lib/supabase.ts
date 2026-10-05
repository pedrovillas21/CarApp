import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Sem configuração, main.tsx mostra a tela de aviso e este cliente nunca é usado.
export const supabase = createClient(url || 'http://localhost', anonKey || 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'frota-crefito11-auth',
  },
});
