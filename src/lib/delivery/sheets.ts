import 'server-only';
import { DeliveryError } from '@/lib/email';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const j: any = await res.json().catch(() => ({}));
  if (res.ok && j.access_token) return j.access_token as string;
  if (j.error === 'invalid_grant' || res.status === 400 || res.status === 401) throw new DeliveryError('needs_reauth: Google access expired or revoked', false, true);
  throw new DeliveryError(`Google token error ${res.status}`, false);
}

async function g(token: string, url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.ok) return res.json().catch(() => ({}));
  const text = (await res.text().catch(() => '')).slice(0, 200);
  if (res.status === 401) throw new DeliveryError('needs_reauth: Google rejected the access token', false, true);
  if (res.status === 429 || res.status >= 500) throw new DeliveryError(`Google Sheets temporary error ${res.status} (quota or outage)`, false);
  if (res.status === 403 || res.status === 404) throw new DeliveryError(`Google Sheets access problem ${res.status}: check the spreadsheet link and sharing. ${text}`, true);
  throw new DeliveryError(`Google Sheets error ${res.status}: ${text}`, true);
}

const BASE_HEADERS = ['Lead ID', 'Received', 'Website', 'Form', 'Name', 'Email', 'Phone', 'Message', 'Status', 'Confidence', 'Page URL', 'Source'];

export interface SheetLead {
  id: string;
  submitted_at: string;
  website: string;
  form: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: string;
  confidence: string;
  page_url: string | null;
  source: string | null;
  data: Record<string, any>;
}

const colName = (n: number) => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

/**
 * Idempotent append: the lead ID lives in column A and is checked before appending, so a retry
 * after a partial failure never creates a duplicate row. Values are written RAW (no formulas run).
 */
export async function appendLeadToSheet(token: string, spreadsheetId: string, sheetName: string, lead: SheetLead) {
  const tab = `'${sheetName.replace(/'/g, "''")}'`;
  const enc = (r: string) => encodeURIComponent(r);

  // header row (create / extend for custom fields)
  const head = await g(token, `${API}/${spreadsheetId}/values/${enc(`${tab}!1:1`)}`);
  let headers: string[] = (head.values?.[0] as string[] | undefined) ?? [];
  if (headers.length === 0) headers = [...BASE_HEADERS];
  const custom = Object.keys(lead.data ?? {});
  const missing = custom.filter((k) => !headers.includes(k));
  if (missing.length || !head.values?.length) {
    headers = [...headers, ...missing];
    await g(token, `${API}/${spreadsheetId}/values/${enc(`${tab}!A1:${colName(headers.length - 1)}1`)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [headers] }),
    });
  }

  // idempotency check
  const ids = await g(token, `${API}/${spreadsheetId}/values/${enc(`${tab}!A:A`)}`);
  if ((ids.values as string[][] | undefined)?.some((r) => r[0] === lead.id)) return;

  const base: Record<string, string> = {
    'Lead ID': lead.id,
    Received: lead.submitted_at,
    Website: lead.website,
    Form: lead.form,
    Name: lead.name ?? '',
    Email: lead.email ?? '',
    Phone: lead.phone ?? '',
    Message: lead.message ?? '',
    Status: lead.status,
    Confidence: lead.confidence,
    'Page URL': lead.page_url ?? '',
    Source: lead.source ?? '',
  };
  const row = headers.map((h) => {
    if (h in base) return base[h];
    const v = lead.data?.[h];
    return Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v);
  });
  await g(token, `${API}/${spreadsheetId}/values/${enc(`${tab}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: [row] }),
  });
}

export function parseSpreadsheetId(input: string): string | null {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  return /^[a-zA-Z0-9-_]{20,}$/.test(input.trim()) ? input.trim() : null;
}
