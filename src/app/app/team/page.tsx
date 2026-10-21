import { requireManager } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { getUsage } from '@/lib/usage';
import { formatDate } from '@/lib/utils';
import { revokeMember, updateClientAccess } from '@/app/actions/team';
import { CreateLoginForm, ResetPasswordForm } from '@/components/TeamForms';
import { LinkButton, Notice, PageHeader, Section } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';

export const metadata = { title: 'Team & clients' };
export const dynamic = 'force-dynamic';
const one = (x: any) => (Array.isArray(x) ? x[0] : x);

export default async function TeamPage() {
  const ctx = await requireManager();
  const ws = ctx.active.workspace;
  const admin = adminClient();
  const usage = await getUsage(ws.id, ws.plan);
  const [{ data: members }, { data: sites }] = await Promise.all([
    admin.from('members').select('id,user_id,role,status,display_name,email,managed,created_at,access:website_access(permission,website:websites(name))').eq('workspace_id', ws.id).neq('status', 'revoked').order('created_at'),
    admin.from('websites').select('id,name').eq('workspace_id', ws.id).order('name'),
  ]);
  const staff = (members ?? []).filter((m: any) => m.role !== 'client');
  const clients = (members ?? []).filter((m: any) => m.role === 'client');
  const canClient = usage.plan.clientLogins > 0 && usage.clients < usage.plan.clientLogins;
  const canStaff = usage.team < usage.plan.teamMembers;

  return (
    <>
      <PageHeader title="Team & clients" description="Give teammates access to everything, or give a client a login that only shows one website." />
      {usage.plan.clientLogins === 0 && <div className="mb-8"><Notice tone="info"><b>Client logins are a Pro feature.</b> Clients see only their own website, under your workspace name and logo. <LinkButton href="/app/billing" variant="ghost" className="ml-1 h-7 px-2 underline">Upgrade</LinkButton></Notice></div>}

      <Section title="Team members" description={`${usage.team} of ${usage.plan.teamMembers} on the ${usage.plan.name} plan.`}>
        <div className="overflow-x-auto border-y hairline"><table className="w-full min-w-[560px]"><tbody>
          {staff.map((m: any) => (
            <tr key={m.id} className="border-t hairline first:border-t-0">
              <td className="td"><div className="font-medium">{m.display_name}</div><div className="text-[12px] text-muted">{m.email}</div></td>
              <td className="td capitalize text-muted">{m.role}</td>
              <td className="td text-[12px] text-muted">Since {formatDate(m.created_at)}</td>
              <td className="td text-right">
                {m.role !== 'owner' && m.user_id !== ctx.user.id && (
                  <div className="flex items-center justify-end gap-2">
                    {m.managed && <ResetPasswordForm memberId={m.id} />}
                    <form action={revokeMember}><input type="hidden" name="member_id" value={m.id} /><SubmitButton variant="danger" className="h-8 px-3 text-[13px]">Revoke</SubmitButton></form>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody></table></div>
      </Section>

      <Section title="Client logins" description={`${usage.clients} of ${usage.plan.clientLogins} on the ${usage.plan.name} plan. Each client sees only the one website you choose.`}>
        {clients.length === 0 ? <p className="text-muted">No client logins yet.</p> : (
          <div className="overflow-x-auto border-y hairline"><table className="w-full min-w-[720px]">
            <thead><tr className="border-b hairline"><th className="th">Client</th><th className="th">Website</th><th className="th">Permission</th><th className="th" /></tr></thead>
            <tbody>
              {clients.map((m: any) => {
                const a = one(m.access);
                return (
                  <tr key={m.id} className="border-t hairline align-top">
                    <td className="td"><div className="font-medium">{m.display_name}</div><div className="text-[12px] text-muted">{m.email}</div></td>
                    <td className="td">{one(a?.website)?.name ?? <span className="text-muted">No website</span>}</td>
                    <td className="td">
                      <form action={updateClientAccess} className="flex items-center gap-2">
                        <input type="hidden" name="member_id" value={m.id} />
                        <select name="permission" defaultValue={a?.permission ?? 'view'} aria-label="Permission" className="field h-8 w-auto py-0 text-[13px]"><option value="view">View only</option><option value="update">Can update</option></select>
                        <button className="text-[13px] text-accent-ink hover:underline">Save</button>
                      </form>
                    </td>
                    <td className="td text-right">
                      <div className="flex items-start justify-end gap-2">
                        {m.managed && <ResetPasswordForm memberId={m.id} />}
                        <form action={revokeMember}><input type="hidden" name="member_id" value={m.id} /><SubmitButton variant="danger" className="h-8 px-3 text-[13px]">Revoke</SubmitButton></form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Section>

      <Section title="Create a login" description="Create an ID and password to share, or send an invite link.">
        {(sites ?? []).length === 0 && <div className="mb-4"><Notice tone="info">Add a website first, then you can give a client access to it.</Notice></div>}
        <CreateLoginForm websites={(sites ?? []) as any[]} canClient={canClient} canStaff={canStaff} />
      </Section>
    </>
  );
}
