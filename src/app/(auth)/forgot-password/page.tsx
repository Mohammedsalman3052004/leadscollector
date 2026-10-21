import Link from 'next/link';
import { ForgotForm } from '@/components/auth/AuthForms';

export const metadata = { title: 'Reset your password' };

export default function Page() {
  return (
    <>
      <h1 className="display text-[40px] leading-none">Reset password</h1>
      <p className="mb-8 mt-3 text-muted">We will email you a link to choose a new one.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-muted"><Link href="/login" className="text-accent-ink hover:underline">Back to sign in</Link></p>
    </>
  );
}
