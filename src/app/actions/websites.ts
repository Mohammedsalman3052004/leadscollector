
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { actionContext } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';
import { newPublicSiteId, randomToken } from '@/lib/crypto';
import { isEmail, isHostname, splitList, str } from '@/lib/forms';
import { normalizeDomain } from '@/lib/ingest/origin';
import { upsertEmailIntegration } from '@/lib/integrations';
import { getUsage } from '@/lib/usage';
import { getWebsiteForManager } from '@/lib/websites';
import type { ActionState } from '@/lib/types';

export async function createWebsite(
  _: ActionState,
  fd: FormData
): Promise<ActionState> {
  const ctx = await actionContext('manager');

  if (!ctx) {
    return { error: 'You do not have permission to add websites.' };
  }

  const ws = ctx.active.workspace;
  const usage = await getUsage(ws.id, ws.plan);

  if (usage.websites >= usage.plan.websites) {
    return {
      error: `Your ${usage.plan.name} plan includes ${usage.plan.websites} website${usage.plan.websites === 1 ? '' : 's'}. Upgrade to add more.`,
    };
  }

  const name = str(fd, 'name', 120);
  const domain = normalizeDomain(str(fd, 'domain', 253));
  const email = str(fd, 'notification_email', 254).toLowerCase();

  if (name.length < 2) {
    return { error: 'Enter a website name.' };
  }

  if (!isHostname(domain)) {
    return {
      error: 'Enter a valid domain such as example.com or localhost.',
    };
  }

  if (email && !isEmail(email)) {
    return { error: 'Notification email is not valid.' };
  }

  let data: { id: string; public_site_id: string } | null = null;
  let error: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  } | null = null;

  try {
    const result = await adminClient()
      .from('websites')
      .insert({
        workspace_id: ws.id,
        name,
        domain,
        allowed_domains: splitList(
          str(fd, 'allowed_domains', 1000)
        )
          .map(normalizeDomain)
          .filter(isHostname)
          .slice(0, 20),
        category: str(fd, 'category', 80) || null,
        description: str(fd, 'description', 500) || null,
        notification_email: email || null,
      })
      .select('id,public_site_id')
      .single();

    data = result.data;
    error = result.error;
  } catch (err) {
    console.error('[createWebsite] Unexpected database error:', err);

    return {
      error: 'Could not add the website. Check the VS Code terminal.',
    };
  }

  if (error || !data) {
    console.error('[createWebsite] Insert failed:', {
      message: error?.message ?? 'No data returned',
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      workspaceId: ws.id,
      domain,
    });

    return {
      error: 'Could not add the website. Check the VS Code terminal.',
    };
  }

  try {
    if (email) {
      await upsertEmailIntegration(ws.id, data.id, [email]);
    }

    await audit(
      ws.id,
      ctx.user.id,
      'website.created',
      data.id,
      { domain }
    );
  } catch (err) {
    console.error(
      '[createWebsite] Post-creation integration/audit error:',
      err
    );

    return {
      error:
        'The website was created, but a follow-up operation failed. Refresh the Websites page before retrying.',
    };
  }

  revalidatePath('/app/websites');

  return {
    ok: true,
    data: {
      id: data.id,
      siteId: data.public_site_id,
      domain,
    },
  };
}

export async function updateWebsite(
  _: ActionState,
  fd: FormData
): Promise<ActionState> {
  const ctx = await actionContext('manager');

  if (!ctx) {
    return { error: 'You do not have permission to do that.' };
  }

  const site = await getWebsiteForManager(
    str(fd, 'id', 40),
    ctx.active.workspace.id
  );

  if (!site) {
    return { error: 'Website not found.' };
  }

  const name = str(fd, 'name', 120);
  const domain = normalizeDomain(str(fd, 'domain', 253));
  const email = str(fd, 'notification_email', 254).toLowerCase();

  if (name.length < 2) {
    return { error: 'Enter a website name.' };
  }

  if (!isHostname(domain)) {
    return { error: 'Enter a valid domain such as example.com.' };
  }

  if (email && !isEmail(email)) {
    return { error: 'Notification email is not valid.' };
  }

  const settings = {
    ...(site.settings ?? {}),
    excluded_fields: splitList(
      str(fd, 'excluded_fields', 1000)
    ).slice(0, 50),
    success_url: str(fd, 'success_url', 300),
    success_selector: str(fd, 'success_selector', 200),
    consent: fd.get('consent') === 'on',
    turnstile: fd.get('turnstile') === 'on',
    allow_localhost: fd.get('allow_localhost') === 'on',
    endpoint_open: fd.get('endpoint_open') === 'on',
  };

  const { error } = await adminClient()
    .from('websites')
    .update({
      name,
      domain,
      allowed_domains: splitList(
        str(fd, 'allowed_domains', 1000)
      )
        .map(normalizeDomain)
        .filter(isHostname)
        .slice(0, 20),
      category: str(fd, 'category', 80) || null,
      description: str(fd, 'description', 500) || null,
      notification_email: email || null,
      settings,
    })
    .eq('id', site.id);

  if (error) {
    console.error('[updateWebsite] Update failed:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    return { error: 'Could not save website settings.' };
  }

  try {
    await upsertEmailIntegration(
      ctx.active.workspace.id,
      site.id,
      email ? [email] : [],
      true
    );

    await audit(
      ctx.active.workspace.id,
      ctx.user.id,
      'website.updated',
      site.id
    );
  } catch (err) {
    console.error('[updateWebsite] Follow-up operation failed:', err);

    return {
      error: 'Settings were saved, but a follow-up operation failed.',
    };
  }

  revalidatePath(`/app/websites/${site.id}`);

  return { ok: true, message: 'Website settings saved.' };
}

export async function regenerateSiteId(fd: FormData) {
  const ctx = await actionContext('manager');

  if (!ctx) return;

  const site = await getWebsiteForManager(
    str(fd, 'id', 40),
    ctx.active.workspace.id
  );

  if (!site) return;

  const { error } = await adminClient()
    .from('websites')
    .update({
      public_site_id: newPublicSiteId(),
      status: 'pending',
    })
    .eq('id', site.id);

  if (error) {
    console.error('[regenerateSiteId] Failed:', error.message);
    return;
  }

  await audit(
    ctx.active.workspace.id,
    ctx.user.id,
    'website.site_id_regenerated',
    site.id
  );

  revalidatePath(`/app/websites/${site.id}`);
}

export async function regenerateSecret(fd: FormData) {
  const ctx = await actionContext('manager');

  if (!ctx) return;

  const site = await getWebsiteForManager(
    str(fd, 'id', 40),
    ctx.active.workspace.id
  );

  if (!site) return;

  const { error } = await adminClient()
    .from('websites')
    .update({
      webhook_secret: 'whsec_' + randomToken(24),
    })
    .eq('id', site.id);

  if (error) {
    console.error('[regenerateSecret] Failed:', error.message);
    return;
  }

  await audit(
    ctx.active.workspace.id,
    ctx.user.id,
    'website.secret_regenerated',
    site.id
  );

  revalidatePath(`/app/websites/${site.id}`);
}

export async function toggleWebsite(fd: FormData) {
  const ctx = await actionContext('manager');

  if (!ctx) return;

  const site = await getWebsiteForManager(
    str(fd, 'id', 40),
    ctx.active.workspace.id
  );

  if (!site) return;

  const next = site.status === 'disabled' ? 'pending' : 'disabled';

  const { error } = await adminClient()
    .from('websites')
    .update({ status: next })
    .eq('id', site.id);

  if (error) {
    console.error('[toggleWebsite] Failed:', error.message);
    return;
  }

  await audit(
    ctx.active.workspace.id,
    ctx.user.id,
    next === 'disabled' ? 'website.paused' : 'website.resumed',
    site.id
  );

  revalidatePath(`/app/websites/${site.id}`);
  revalidatePath('/app/websites');
}

export async function deleteWebsite(fd: FormData) {
  const ctx = await actionContext('manager');

  if (!ctx) return;

  const site = await getWebsiteForManager(
    str(fd, 'id', 40),
    ctx.active.workspace.id
  );

  if (!site) return;

  if (str(fd, 'confirm', 253).toLowerCase() !== site.domain) {
    return;
  }

  const { error } = await adminClient()
    .from('websites')
    .delete()
    .eq('id', site.id);

  if (error) {
    console.error('[deleteWebsite] Failed:', error.message);
    return;
  }

  await audit(
    ctx.active.workspace.id,
    ctx.user.id,
    'website.deleted',
    site.id,
    { domain: site.domain }
  );

  redirect('/app/websites');
}

export async function renameForm(fd: FormData) {
  const ctx = await actionContext('manager');

  if (!ctx) return;

  const site = await getWebsiteForManager(
    str(fd, 'website_id', 40),
    ctx.active.workspace.id
  );

  const name = str(fd, 'name', 100);

  if (!site || name.length < 1) return;

  const { error } = await adminClient()
    .from('forms')
    .update({ name })
    .eq('id', str(fd, 'form_id', 40))
    .eq('website_id', site.id);

  if (error) {
    console.error('[renameForm] Failed:', error.message);
    return;
  }

  revalidatePath(`/app/websites/${site.id}`);
}
