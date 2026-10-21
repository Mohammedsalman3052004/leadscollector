'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SubmitButton } from '@/components/submit-button';
import { Notice, buttonClass } from '@/components/ui';
import { forgotPassword, login, signup, updatePassword } from '@/app/actions/auth';

export function GoogleButton({ next = '/app', label = 'Continue with Google' }: { next?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        className={buttonClass('secondary', 'w-full')}
        onClick={async () => {
          setBusy(true);
          const { error } = await createClient().auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
          });
          if (error) { setErr(error.message); setBusy(false); }
        }}
      >
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
        {busy ? 'Redirecting...' : label}
      </button>
      {err && <p className="mt-2 text-[12px] text-red-700">{err}</p>}
    </div>
  );
}

const Divider = () => (
  <div className="my-6 flex items-center gap-3 text-[12px] text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
);

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action] = useActionState(login, null);
  return (
    <div>
      <GoogleButton next={next} />
      <Divider />
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required className="field" /></div>
        <div>
          <div className="flex justify-between"><label className="label" htmlFor="password">Password</label><Link href="/forgot-password" className="text-[12px] text-accent-ink hover:underline">Forgot password?</Link></div>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
        </div>
        {notice && <Notice tone="warn">{notice}</Notice>}
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        <SubmitButton className="w-full" pendingLabel="Signing in...">Sign in</SubmitButton>
      </form>
      <p className="mt-6 text-center text-muted">New to Leadscollector? <Link href="/signup" className="font-medium text-accent-ink hover:underline">Create an account</Link></p>
    </div>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signup, null);
  return (
    <div>
      <GoogleButton label="Sign up with Google" />
      <Divider />
      <form action={action} className="space-y-4">
        <div><label className="label" htmlFor="name">Your name</label><input id="name" name="name" autoComplete="name" required minLength={2} className="field" /></div>
        <div><label className="label" htmlFor="email">Work email</label><input id="email" name="email" type="email" autoComplete="email" required className="field" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="field" /><p className="mt-1.5 text-[12px] text-muted">At least 10 characters.</p></div>
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        {state?.ok && <Notice tone="success">{state.message}</Notice>}
        <SubmitButton className="w-full" pendingLabel="Creating account...">Create account</SubmitButton>
        <p className="text-[12px] text-muted">By creating an account you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      </form>
      <p className="mt-6 text-center text-muted">Already have an account? <Link href="/login" className="font-medium text-accent-ink hover:underline">Sign in</Link></p>
    </div>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(forgotPassword, null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="field" /></div>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="success">{state.message}</Notice>}
      <SubmitButton className="w-full">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm() {
  const [state, action] = useActionState(updatePassword, null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" minLength={10} autoComplete="new-password" required className="field" /></div>
      <div><label className="label" htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" minLength={10} autoComplete="new-password" required className="field" /></div>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="success">{state.message} <Link href="/app" className="font-medium underline">Continue to dashboard</Link></Notice>}
      <SubmitButton className="w-full">Update password</SubmitButton>
    </form>
  );
}
