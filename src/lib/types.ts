export type Role = 'owner' | 'admin' | 'member' | 'client';
export type PlanId = 'free' | 'pro';
export type LeadStatus = 'new' | 'contacted' | 'follow_up' | 'qualified' | 'converted' | 'lost';
export type Confidence = 'confirmed' | 'probable' | 'attempted';

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  plan: PlanId;
  suspended: boolean;
}

export interface Membership {
  id: string;
  role: Role;
  workspace: WorkspaceRow;
}

export type FieldValue = string | string[];

/** Result object returned by server actions used with useActionState. */
export type ActionState =
  | { ok?: boolean; error?: string; message?: string; data?: Record<string, any> }
  | null;
