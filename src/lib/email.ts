import 'server-only';
import { escapeHtml } from '@/lib/utils';

export class DeliveryError extends Error {
  constructor(message: string, public permanent = false, public reauth = false) {
    super(message);
  }
}

export interface Mail {
  to: string[];
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

/** Sends through Resend's REST API. Swap this function to use another provider. */
export async function sendEmail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new DeliveryError('Email provider is not configured (RESEND_API_KEY)', true);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(mail.idempotencyKey ? { 'Idempotency-Key': mail.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Leadscollector <onboarding@resend.dev>',
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (res.ok) return;
  const detail = (await res.text().catch(() => '')).slice(0, 300);
  const transient = res.status === 429 || res.status >= 500;
  throw new DeliveryError(`Email provider error ${res.status}: ${detail}`, !transient);
}

// ------------------------------------------------------------------ templates
function layout(title: string, body: string) {
  return `<div style="background:#FAF8F4;padding:32px;font-family:'DM Sans',Arial,sans-serif;color:#1C1B19">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E3DA;border-radius:12px;padding:32px">
    <div style="font-family:Georgia,serif;font-size:24px;font-weight:600">Leadscollector</div>
    <h1 style="font-size:20px;margin:24px 0 12px">${escapeHtml(title)}</h1>${body}
  </div></div>`;
}
const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#B8924A;color:#1C1B19;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a></p>`;

export function inviteEmail(opts: { workspace: string; inviter: string; link: string }) {
  const title = `You have been invited to ${opts.workspace}`;
  return {
    subject: title,
    html: layout(title, `<p style="color:#6B675F;line-height:1.6">${escapeHtml(opts.inviter)} gave you access to a lead dashboard on Leadscollector. Click below to set your password and sign in.</p>${button(opts.link, 'Accept invite')}`),
    text: `${opts.inviter} invited you to ${opts.workspace} on Leadscollector.\nSet your password: ${opts.link}`,
  };
}

export function newLeadEmail(opts: {
  website: string; form: string; lead: { name: string | null; email: string | null; phone: string | null; message: string | null; data: Record<string, any>; page_url: string | null; confidence: string };
  link: string;
}) {
  const rows: [string, string][] = [];
  if (opts.lead.name) rows.push(['Name', opts.lead.name]);
  if (opts.lead.email) rows.push(['Email', opts.lead.email]);
  if (opts.lead.phone) rows.push(['Phone', opts.lead.phone]);
  if (opts.lead.message) rows.push(['Message', opts.lead.message]);
  for (const [k, v] of Object.entries(opts.lead.data ?? {})) rows.push([k, Array.isArray(v) ? v.join(', ') : String(v)]);
  if (opts.lead.page_url) rows.push(['Page', opts.lead.page_url]);
  const table = rows
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#6B675F;vertical-align:top;font-size:13px">${escapeHtml(k)}</td><td style="padding:6px 0;font-size:14px">${escapeHtml(v)}</td></tr>`)
    .join('');
  const title = `New lead from ${opts.website}`;
  return {
    subject: title,
    html: layout(title, `<p style="color:#6B675F;margin:0 0 12px;font-size:13px">${escapeHtml(opts.form)} - ${escapeHtml(opts.lead.confidence)} submission</p><table>${table}</table>${button(opts.link, 'Open in dashboard')}`),
    text: `${title}\n${opts.form}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${opts.link}`,
  };
}

export function reauthEmail(opts: { website: string; link: string }) {
  const title = 'Reconnect Google Sheets';
  return {
    subject: `${title} for ${opts.website}`,
    html: layout(title, `<p style="color:#6B675F;line-height:1.6">Google access for <b>${escapeHtml(opts.website)}</b> expired or was revoked. Your leads are safe in Leadscollector; reconnect to resume Sheets syncing.</p>${button(opts.link, 'Reconnect')}`),
    text: `${title} for ${opts.website}: ${opts.link}`,
  };
}
