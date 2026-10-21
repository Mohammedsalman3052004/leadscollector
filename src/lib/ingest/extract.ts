import type { CleanFields } from './sanitize';

export interface CoreFields {
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  rest: CleanFields;
}

const EMAIL_VALUE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const asString = (v: string | string[]) => (Array.isArray(v) ? v.join(', ') : v);

/**
 * Pull name / email / phone / message out of arbitrary field names so every site
 * can use its own form structure. Everything else stays in `rest` (stored as JSON).
 */
export function extractCore(fields: CleanFields): CoreFields {
  const rest: CleanFields = { ...fields };
  const take = (key: string) => {
    const v = rest[key];
    delete rest[key];
    return asString(v);
  };
  const keys = () => Object.keys(rest);

  let email: string | null = null;
  const emailKey = keys().find((k) => /e-?mail/i.test(k) && EMAIL_VALUE.test(asString(rest[k]).trim())) ??
    keys().find((k) => EMAIL_VALUE.test(asString(rest[k]).trim()));
  if (emailKey) email = take(emailKey).trim().toLowerCase();

  let phone: string | null = null;
  const phoneKey = keys().find((k) => /phone|mobile|whatsapp|\btel\b|telephone|contact.?(no|number)/i.test(k) && asString(rest[k]).replace(/\D/g, '').length >= 7);
  if (phoneKey) phone = take(phoneKey).trim();

  let name: string | null = null;
  const fullKey = keys().find((k) => /^(full.?|your.?|customer.?|contact.?)?name$/i.test(k.trim()));
  if (fullKey) name = take(fullKey).trim();
  else {
    const first = keys().find((k) => /first.?name|fname|given.?name/i.test(k));
    const last = keys().find((k) => /last.?name|lname|surname|family.?name/i.test(k));
    const parts: string[] = [];
    if (first) parts.push(take(first));
    if (last) parts.push(take(last));
    if (parts.length) name = parts.join(' ').trim();
  }

  let message: string | null = null;
  const msgKey = keys().find((k) => /message|enquiry|inquiry|comment|requirement|query|details|note|description|how can we help/i.test(k));
  if (msgKey) message = take(msgKey).trim();

  return {
    name: name || null,
    email: email || null,
    phone: phone || null,
    message: message || null,
    rest,
  };
}
