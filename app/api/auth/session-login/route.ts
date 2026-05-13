import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const AUTH = ['chrome-extension://kdmffkblhinlggeopcglmhoolgmmfdaj',,'https://chattersinnercircle.vercel.app','https://chattersinnercircle.vercel.app','http://localhost:3000'];
function cors(o: string|null) { const r = o && AUTH.includes(o) ? o : AUTH[0]; return { 'Access-Control-Allow-Origin': r, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }; }

export async function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) }); }

export async function POST(req: NextRequest) {
  const h = cors(req.headers.get('origin'));
  let email = '';
  try { const b = await req.json(); email = (b.email || '').trim().toLowerCase(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: h }); }
  if (!email.includes('@')) return NextResponse.json({ error: 'Valid email required.' }, { status: 400, headers: h });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: p, error } = await db.from('profiles')
    .select('id,email,plan,plan_status,trial_ends_at,plan_expires_at,daily_generations,max_daily_generations,total_generations')
    .eq('email', email).maybeSingle();

  if (error || !p) return NextResponse.json({ error: 'No account found. Sign up at chattersinnercircle.vercel.app first.' }, { status: 404, headers: h });
  if (p.plan_status !== 'approved') return NextResponse.json({ reason: 'not_approved', error: 'Account not approved. Contact admin.' }, { status: 403, headers: h });

  const now = new Date();
  if (p.plan === 'free' && (!p.trial_ends_at || new Date(p.trial_ends_at) < now))
    return NextResponse.json({ reason: 'expired', error: 'Your 7-day trial has ended. Upgrade to Basic ($8/mo) or Pro ($15/mo).', upgrade: true }, { status: 403, headers: h });
  if ((p.plan === 'basic' || p.plan === 'pro') && p.plan_expires_at && new Date(p.plan_expires_at) < now)
    return NextResponse.json({ reason: 'expired', error: 'Your plan has expired. Please renew.', upgrade: true }, { status: 403, headers: h });

  const { data: op } = await db.from('operators').select('allow_multiple_devices').eq('email', email).maybeSingle();
  const token = crypto.randomBytes(32).toString('hex');
  await db.from('active_sessions').upsert({ email, user_id: p.id, session_token: token, allow_multiple: op?.allow_multiple_devices ?? false, logged_in_at: now.toISOString() }, { onConflict: 'email' });

  return NextResponse.json({ session_token: token, user: { email: p.email, plan: p.plan, plan_status: p.plan_status, trial_ends_at: p.trial_ends_at, plan_expires_at: p.plan_expires_at, daily_generations: p.daily_generations, max_daily_generations: p.max_daily_generations, total_generations: p.total_generations } }, { status: 200, headers: h });
}
