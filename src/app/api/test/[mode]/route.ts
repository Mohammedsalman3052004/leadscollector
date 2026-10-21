import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Dev-only helper endpoints used by /test-forms: /api/test/ok, /api/test/fail, /api/test/json-fail */
export async function POST(_req: Request, ctx: { params: Promise<{ mode: string }> }) {
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_TEST_FORMS) return new NextResponse('Not found', { status: 404 });
  const { mode } = await ctx.params;
  if (mode === 'fail') return NextResponse.json({ error: 'server exploded' }, { status: 500 });
  if (mode === 'json-fail') return NextResponse.json({ success: false, error: 'validation failed' }, { status: 200 });
  return NextResponse.json({ success: true });
}
