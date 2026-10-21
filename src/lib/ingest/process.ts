import 'server-only';
import { adminClient } from '@/lib/supabase/admin';
import { planOf } from '@/lib/plans';
import { sha256Hex } from '@/lib/crypto';
import type { Confidence } from '@/lib/types';
import { sanitizeFields } from './sanitize';
import { extractCore } from './extract';
import { computeDedupeKey } from './dedupe';
import { hostOf } from './origin';

export interface SiteRecord {
  id: string;
  workspace_id: string;
  domain: string;
  allowed_domains: string[];
  status: string;
  public_site_id: string;
  webhook_secret: string;
  settings: Record<string, any>;
  workspace: { plan: string; suspended: boolean };
}

export async function loadSite(publicId: string): Promise<SiteRecord | null> {
  if (!/^[A-Za-z0-9_]{8,64}$/.test(publicId)) return null;
  const { data } = await adminClient()
    .from('websites')
    .select('id,workspace_id,domain,allowed_domains,status,public_site_id,webhook_secret,settings,workspace:workspaces(plan,suspended)')
    .eq('public_site_id', publicId)
    .maybeSingle();
  if (!data) return null;
  const row: any = data;
  const ws = Array.isArray(row.workspace) ? row.workspace[0] : row.workspace;
  if (!ws) return null;
  return { ...row, settings: row.settings ?? {}, workspace: ws } as SiteRecord;
}

export function siteUsable(site: SiteRecord) {
  return site.status !== 'disabled' && !site.workspace.suspended;
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await adminClient().rpc('rl_hit', { p_key: key, p_limit: limit, p_window: windowSeconds });
  if (error) return true; // fail open: never lose leads because the limiter is down
  return data === true;
}

export async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const j = (await res.json()) as { success?: boolean };
    return j.success === true;
  } catch {
    return false;
  }
}

function safeUrl(u?: string | null) {
  return u && /^https?:\/\//i.test(u) ? u.slice(0, 2000) : null;
}

export interface IngestArgs {
  site: SiteRecord;
  submissionId: string;
  confidence: Confidence;
  signal: string;
  formFingerprint: string;
  formName: string;
  fields?: unknown;
  promoteOnly?: boolean;
  pageUrl?: string | null;
  referrer?: string | null;
  utm?: Record<string, string> | null;
  ip?: string | null;
  userAgent?: string | null;
  submittedAt?: string | null;
}

export type IngestStatus = 'created' | 'updated' | 'duplicate' | 'locked' | 'dropped' | 'not_found';

export async function ingest(args: IngestArgs): Promise<{ status: IngestStatus; lead_id?: string }> {
  const { site } = args;
  const excluded = Array.isArray(site.settings.excluded_fields) ? (site.settings.excluded_fields as string[]) : [];
  const clean = sanitizeFields(args.fields, excluded);
  const hasFields = Object.keys(clean).length > 0;
  if (!hasFields && !args.promoteOnly) return { status: 'dropped' };

  const core = extractCore(clean);
  const utm: Record<string, string> = {};
  for (const [k, v] of Object.entries(args.utm ?? {})) if (typeof v === 'string') utm[k.slice(0, 40)] = v.slice(0, 200);
  const referrerHost = hostOf(args.referrer);
  const source = utm.utm_source || (referrerHost && !site.domain.includes(referrerHost) ? referrerHost : null) || 'direct';
  const salt = process.env.IP_HASH_SALT || 'lc';

  const payload = {
    website_id: site.id,
    workspace_id: site.workspace_id,
    monthly_cap: planOf(site.workspace.plan).leadsPerMonth,
    form_name: args.formName.slice(0, 120),
    form_fingerprint: args.formFingerprint.slice(0, 64),
    submission_id: args.submissionId,
    confidence: args.confidence,
    signal: args.signal.slice(0, 40),
    promote_only: !!args.promoteOnly,
    name: core.name,
    email: core.email,
    phone: core.phone,
    message: core.message,
    data: core.rest,
    page_url: safeUrl(args.pageUrl),
    referrer: safeUrl(args.referrer),
    utm,
    source,
    ip_hash: args.ip ? sha256Hex(salt + args.ip) : null,
    user_agent: args.userAgent ?? null,
    dedupe_key: hasFields ? computeDedupeKey(site.id, args.formFingerprint, core) : null,
    submitted_at: args.submittedAt ?? null,
  };

  const { data, error } = await adminClient().rpc('ingest_lead', { p: payload });
  if (error) throw new Error(error.message);
  return data as { status: IngestStatus; lead_id?: string };
}
