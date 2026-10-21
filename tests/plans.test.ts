import { describe, expect, it } from 'vitest';
import { PLANS, planOf } from '@/lib/plans';
import { csvCell, safeNext } from '@/lib/utils';
import { verifyStripeSignature } from '@/lib/billing/stripe';
import { hmacHex } from '@/lib/crypto';

describe('plans', () => {
  it('matches the product spec', () => {
    expect(PLANS.free).toMatchObject({ websites: 100, leadsPerMonth: 1000, clientLogins: 0, sheets: false, whiteLabel: false, retentionDays: 30 });
    expect(PLANS.pro.clientLogins).toBeGreaterThan(0);
    expect(PLANS.pro.sheets && PLANS.pro.whiteLabel).toBe(true);
  });
  it('falls back to free for unknown plans', () => {
    expect(planOf('enterprise').id).toBe('free');
    expect(planOf(undefined).id).toBe('free');
  });
});

describe('helpers', () => {
  it('neutralises CSV formula injection and quotes cells', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell(['x', 'y'])).toBe('x; y');
  });
  it('only allows same-site redirects', () => {
    expect(safeNext('/app/leads')).toBe('/app/leads');
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil', undefined, 5]) expect(safeNext(bad as unknown)).toBe('/app');
  });
  it('verifies Stripe signatures within tolerance', () => {
    const t = String(Math.floor(Date.now() / 1000));
    const body = '{"id":"evt"}';
    const header = `t=${t},v1=${hmacHex('whsec', `${t}.${body}`)}`;
    expect(verifyStripeSignature(body, header, 'whsec')).toBe(true);
    expect(verifyStripeSignature(body + 'x', header, 'whsec')).toBe(false);
    expect(verifyStripeSignature(body, `t=1,v1=${hmacHex('whsec', `1.${body}`)}`, 'whsec')).toBe(false);
  });
});
