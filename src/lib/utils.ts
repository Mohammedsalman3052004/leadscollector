export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const TZ = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Kolkata';

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(new Date(value));
}
export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: TZ }).format(new Date(value));
}
export function formatShortDay(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: TZ }).format(new Date(value));
}
export function dayKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(value)); // YYYY-MM-DD
}

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'workspace'
  );
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

export function safeNext(value: unknown, fallback = '/app') {
  const v = typeof value === 'string' ? value : '';
  return v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : fallback;
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://leadscollectors.vercel.app').replace(/\/$/, '');
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** CSV cell with formula-injection protection. */
export function csvCell(value: unknown) {
  let s = value == null ? '' : Array.isArray(value) ? value.join('; ') : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
