import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type AnyClient = SupabaseClient<any, 'public', any>;
let cached: AnyClient | null = null;

/**
 * Service-role client: BYPASSES Row Level Security. Use only in server code, only after the
 * caller has been authorized (ingestion, jobs, admin, privileged server actions).
 */
export function adminClient(): AnyClient {
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase service credentials are not configured');
    cached = createClient<any, 'public', any>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return cached;
}
