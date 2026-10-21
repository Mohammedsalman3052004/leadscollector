import { sha256Hex } from '@/lib/crypto';
import type { CoreFields } from './extract';

export function computeDedupeKey(siteId: string, fingerprint: string, core: CoreFields): string {
  const digits = (core.phone ?? '').replace(/\D/g, '');
  const body = [core.email ?? '', digits, (core.name ?? '').toLowerCase(), core.message ?? '', JSON.stringify(core.rest)].join('|');
  return sha256Hex([siteId, fingerprint, body].join('::'));
}
