/**
 * Privacy-first field filtering. The browser tracker filters too, but the server never trusts it:
 * everything is filtered again here before anything is stored.
 */
export const MAX_FIELDS = 60;
export const MAX_VALUE = 5000;
export const MAX_KEY = 100;

const SENSITIVE_NAME =
  /(pass(word|wd|phrase)?|pwd|card.?(num|number|no)?|ccnum|cc[-_ ]?(num|number|exp|csc|cvc)|cvv|cvc|csrf|xsrf|token|otp|one[-_ ]?time|ssn|social[-_ ]?security|aadhaa?r|pan[-_ ]?(no|number|card)|secret|api[-_ ]?key|nonce|captcha|honeypot|gotcha|iban|routing[-_ ]?number|account[-_ ]?number|_wp)/i;

export function isSensitiveName(name: string): boolean {
  return SENSITIVE_NAME.test(name);
}

function luhn(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Replace anything that looks like a payment card number. */
export function redactCards(value: string): string {
  return value.replace(/\b\d(?:[ -]?\d){12,18}\b/g, (m) => {
    const d = m.replace(/\D/g, '');
    return d.length >= 13 && d.length <= 19 && luhn(d) ? '[redacted]' : m;
  });
}

export function cleanText(value: string, max = MAX_VALUE): string {
  // strip control characters; React escapes on render, CSV export neutralises formulas
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

export type CleanFields = Record<string, string | string[]>;

export function sanitizeFields(raw: unknown, excluded: string[] = []): CleanFields {
  const out: CleanFields = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const skip = new Set(excluded.map((e) => e.toLowerCase()));
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_FIELDS) break;
    const key = cleanText(k, MAX_KEY);
    if (!key || isSensitiveName(key) || skip.has(key.toLowerCase())) continue;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

    let value: string | string[] | null = null;
    if (typeof v === 'string') value = redactCards(cleanText(v));
    else if (typeof v === 'number' || typeof v === 'boolean') value = String(v);
    else if (Array.isArray(v)) {
      const items = v
        .slice(0, 50)
        .filter((x) => ['string', 'number', 'boolean'].includes(typeof x))
        .map((x) => redactCards(cleanText(String(x))))
        .filter(Boolean);
      value = items.length ? items : null;
    }
    if (value === null || value === '' ) continue;
    out[key] = value;
    count++;
  }
  return out;
}
