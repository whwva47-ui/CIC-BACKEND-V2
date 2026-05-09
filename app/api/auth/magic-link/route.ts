export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const OPEN = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://chattersinnercircle.vercel.app';

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: OPEN }); }

export async function POST(req: NextRequest) {
  let email = '', referralCode = '';
  try { const b = await req.json(); email = (b.email || '').trim().toLowerCase(); referralCode = b.referralCode || ''; }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: OPEN }); }

  if (!email.includes('@')) return NextResponse.json({ error: 'Valid email required.' }, { status: 400, headers: OPEN });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { error } = await anon.auth.signInWithOtp({ email, options: { emailRedirectTo: `${SITE}/landing`, shouldCreateUser: true } });

  if (error) {
    console.error('[magic-link] Supabase error:', error.status, error.message);
    if (error.status === 429) return NextResponse.json({ error: 'Too many requests. Wait a minute.' }, { status: 429, headers: OPEN });
    return NextResponse.json({ error: error.message, code: error.status }, { status: 500, headers: OPEN });;
  }

  if (referralCode) {
    try {
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await db.from('pro_requests').insert({ email, request_type: 'referral_signup', payment_method: referralCode, status: 'pending' });
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ success: true }, { headers: OPEN });
}
