import { redirect } from 'next/navigation';
import { ResetForm } from '@/components/auth/AuthForms';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Choose a new password' };

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=link');
  return (
    <>
      <h1 className="display text-[40px] leading-none">Choose a password</h1>
      <p className="mb-8 mt-3 text-muted">Set the password you will use to sign in.</p>
      <ResetForm />
    </>
  );
}
