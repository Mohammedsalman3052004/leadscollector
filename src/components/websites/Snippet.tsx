'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/copy-button';
import { CodeBlock } from '@/components/ui';
import { cn } from '@/lib/utils';

export function snippetFor(appUrl: string, siteId: string) {
  return `<script src="${appUrl}/lc.js" data-site-id="${siteId}" async></script>`;
}

export function SnippetTabs({ appUrl, siteId }: { appUrl: string; siteId: string }) {
  const tabs = {
    HTML: { text: snippetFor(appUrl, siteId), hint: 'Paste inside the <head> of every page (or your shared layout/template).' },
    'Next.js': {
      text: `import Script from 'next/script';\n\n// in app/layout.tsx, inside <body>\n<Script src="${appUrl}/lc.js" data-site-id="${siteId}" strategy="afterInteractive" />`,
      hint: 'Add to your root layout. For server-action forms also dispatch window.dispatchEvent(new Event("leadscollector:success")) after success.',
    },
    WordPress: { text: snippetFor(appUrl, siteId), hint: 'Use a header/footer scripts plugin or header.php. Contact Form 7, WPForms, Gravity Forms and Elementor are confirmed automatically.' },
    Webflow: { text: snippetFor(appUrl, siteId), hint: 'Project Settings, Custom Code, Head Code, then publish. The Webflow success message is detected automatically.' },
  } as const;
  const [tab, setTab] = useState<keyof typeof tabs>('HTML');
  return (
    <div>
      <div className="mb-3 flex gap-1 border-b hairline" role="tablist">
        {(Object.keys(tabs) as (keyof typeof tabs)[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn('-mb-px h-10 border-b-2 px-4 font-medium transition-colors', tab === t ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink')}>{t}</button>
        ))}
      </div>
      <CodeBlock>{tabs[tab].text}</CodeBlock>
      <div className="mt-3 flex items-start justify-between gap-4"><p className="text-[13px] text-muted">{tabs[tab].hint}</p><CopyButton text={tabs[tab].text} label="Copy snippet" /></div>
    </div>
  );
}
