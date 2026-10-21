import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: { default: 'Leadscollector - Paste one snippet. Receive every lead.', template: '%s | Leadscollector' },
  description: 'Collect, organize and manage website leads for every client site from one dashboard. One script tag, honest confirmation levels, client logins.',
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#FAF8F4' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
