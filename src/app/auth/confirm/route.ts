import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TYPES: EmailOtpType[] = ['invite', 'recovery', 'signup', 'magiclink', 'email'];

/** Token-hash links (client invites created from the Team page). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  if (hash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: hash });
    if (!error) return NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')), url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
