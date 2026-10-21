import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Supabase client bound to the signed-in user. Row Level Security applies. */
export async function createClient() {
  const store = await cookies();
  return createServerClient<any, 'public', any>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options?: any }[]) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a Server Component: middleware refreshes the session */
        }
      },
    },
  });
}
