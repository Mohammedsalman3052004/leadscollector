'use server';

/** Stand-in for a Next.js server action form handler (opaque to the tracker). */
export async function fakeServerAction(formData: FormData) {
  void formData;
  return { ok: true };
}
