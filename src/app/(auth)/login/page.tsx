import { LoginForm } from '@/components/auth/AuthForms';
import { safeNext } from '@/lib/utils';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="display text-[40px] leading-none">Welcome back</h1>
      <p className="mb-8 mt-3 text-muted">Sign in to your dashboard.</p>
      <LoginForm next={safeNext(sp.next)} notice={sp.error === 'link' ? 'That link is invalid or has expired. Please sign in or request a new one.' : undefined} />
    </>
  );
}
