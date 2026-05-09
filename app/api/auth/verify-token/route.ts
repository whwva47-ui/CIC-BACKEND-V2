import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const AUTH = ['https://chattersinnercircle.vercel.app','https://cic-app.pages.dev','chrome-extension://dkgpheiimhedhdfandcgeogmbfmmiobp','http://localhost:3000'];
function cors(o: string|null) { const r = o && AUTH.includes(o) ? o : AUTH[0]; return { 'Access-Control-Allow-Origin': r, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }; }

export async function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) }); }

export async function POST(req: NextRequest) {
  const h = cors(req.headers.get('origin'));
  let token = '';
  try { const b = await req.json(); token = (b.token || '').trim(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: h }); }
  if (!token) return NextResponse.json({ error: 'Token required.' }, { status: 400, headers: h });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const { data: rec, error: le } = await db.from('extension_tokens').select('id,user_id,email,expires_at,used').eq('token_hash', hash).maybeSingle();

  if (le || !rec) return NextResponse.json({ error: 'Invalid login link. Sign in again from the extension.' }, { status: 401, headers: h });
  if (new Date(rec.expires_at) < new Date()) { await db.from('extension_tokens').delete().eq('id', rec.id); return NextResponse.json({ error: 'Login link expired.' }, { status: 401, headers: h }); }
  if (rec.used) return NextResponse.json({ error: 'Login link already used.' }, { status: 401, headers: h });

  await db.from('extension_tokens').update({ used: true }).eq('id', rec.id);
  const { data: p, error: pe } = await db.from('profiles').select('id,email,plan,plan_status,trial_ends_at,plan_expires_at,daily_generations,max_daily_generations,total_generations').eq('id', rec.user_id).single();
  if (pe || !p) return NextResponse.json({ error: 'User not found.' }, { status: 404, headers: h });
  return NextResponse.json({ user: p }, { status: 200, headers: h });
}
