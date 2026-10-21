'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/** Subscribes to new leads for this workspace (Row Level Security limits what each user receives). */
export function RealtimeLeads({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`leads-${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `workspace_id=eq.${workspaceId}` }, (payload: any) => {
        const row = payload.new ?? {};
        if (payload.eventType === 'INSERT' && row.confidence !== 'attempted') {
          setToast(row.name ? `New lead: ${row.name}` : 'New lead received');
          setTimeout(() => setToast(null), 6000);
        }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 600);
      })
      .subscribe();
    return () => { if (timer.current) clearTimeout(timer.current); supabase.removeChannel(channel); };
  }, [workspaceId, router]);

  if (!toast) return null;
  return (
    <div role="status" className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border hairline bg-surface px-4 py-3 shadow-pop">
      <Bell size={16} className="text-accent-ink" /><span className="font-medium">{toast}</span>
    </div>
  );
}
