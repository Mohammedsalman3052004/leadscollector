'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { buttonClass } from '@/components/ui';

export function CopyButton({ text, label = 'Copy', variant = 'secondary' }: { text: string; label?: string; variant?: 'primary' | 'secondary' | 'ghost' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass(variant, 'h-8 px-3 text-[13px]')}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* clipboard blocked */ }
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? 'Copied' : label}
    </button>
  );
}
