import { SignupForm } from '@/components/auth/AuthForms';

export const metadata = { title: 'Create your account' };

export default function SignupPage() {
  return (
    <>
      <h1 className="display text-[40px] leading-none">Create your account</h1>
      <p className="mb-8 mt-3 text-muted">Free plan. No card required.</p>
      <SignupForm />
    </>
  );
}
