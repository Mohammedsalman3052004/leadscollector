import type { PlanId } from './types';

/** Edit these numbers/prices to change your plans. Limits are enforced on the server. */
export interface PlanDef {
  id: PlanId;
  name: string;
  price: string;
  tagline: string;
  websites: number;
  leadsPerMonth: number;
  teamMembers: number;
  clientLogins: number;
  sheets: boolean;
  whiteLabel: boolean;
  retentionDays: number;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: 'free', name: 'Free', price: '$0', tagline: 'For trying it on one site',
    websites: 100, leadsPerMonth: 1000, teamMembers: 1, clientLogins: 0,
    sheets: false, whiteLabel: false, retentionDays: 30,
  },
  pro: {
    id: 'pro', name: 'Pro', price: '$19', tagline: 'For agencies and freelancers',
    websites: 25, leadsPerMonth: 5000, teamMembers: 10, clientLogins: 50,
    sheets: true, whiteLabel: true, retentionDays: 730,
  },
};

export function planOf(id: string | null | undefined): PlanDef {
  return id === 'pro' ? PLANS.pro : PLANS.free;
}

export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free: ['1 website', '100 confirmed leads / month', 'Email notifications', 'CSV export', '30-day retention'],
  pro: [
    '25 websites', '5,000 leads / month', 'Client logins (up to 50)', 'Google Sheets sync',
    'White-label client portal', 'Team members', '2-year retention',
  ],
};
