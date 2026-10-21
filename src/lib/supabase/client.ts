import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient<any, 'public', any>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
