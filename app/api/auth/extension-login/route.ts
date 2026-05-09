import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const AUTH = ['chrome-extension://dkgpheiimhedhdfandcgeogmbfmmiobp','https://chattersinnercircle.vercel.app','https://cic-app.pages.dev','http://localhost:3000'];
function cors(o: string|null) { const r = o && AUTH.includes(o) ? o : AUTH[0]; return { 'Access-Control-Allow-Origin': r, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }; }

export async function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) }); }

export async function POST(req: NextRequest) {
  const h = cors(req.headers.get('origin'));
  let email = '';
  try { const b = await req.json(); email = (b.email || '').trim().toLowerCase(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: h }); }
  if (!email.includes('@')) return NextResponse.json({ error: 'Email required.' }, { status: 400, headers: h });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: p, error } = await db.from('profiles').select('id,email,plan,plan_status').eq('email', email).maybeSingle();
  if (error || !p) return NextResponse.json({ error: 'Email not registered. Sign up at chattersinnercircle.vercel.app first.' }, { status: 404, headers: h });

  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  await db.from('extension_tokens').insert({ user_id: p.id, email: p.email, token_hash: hash, expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), used: false });
  return NextResponse.json({ token: raw }, { status: 200, headers: h });
}
