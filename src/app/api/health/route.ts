import { adminClient } from '@/lib/supabase/admin';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { error } = await adminClient().from('workspaces').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) throw error;
    return json({ ok: true, db: 'up', time: new Date().toISOString() });
  } catch {
    return json({ ok: false, db: 'down' }, 503);
  }
}
