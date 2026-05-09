import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const AUTH = ['chrome-extension://dkgpheiimhedhdfandcgeogmbfmmiobp','https://chattersinnercircle.vercel.app','https://cic-app.pages.dev','http://localhost:3000'];
function cors(o: string|null) { const r = o && AUTH.includes(o) ? o : AUTH[0]; return { 'Access-Control-Allow-Origin': r, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }; }

export async function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) }); }

export async function POST(req: NextRequest) {
  const h = cors(req.headers.get('origin'));
  let email = '', token = '';
  try { const b = await req.json(); email = (b.email || '').trim().toLowerCase(); token = (b.session_token || '').trim(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: h }); }
  if (!email || !token) return NextResponse.json({ error: 'email and session_token required.' }, { status: 400, headers: h });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: s, error } = await db.from('active_sessions').select('session_token,allow_multiple').eq('email', email).maybeSingle();

  if (error || !s) return NextResponse.json({ valid: false, reason: 'no_session' }, { status: 401, headers: h });
  if (s.allow_multiple) return NextResponse.json({ valid: true }, { status: 200, headers: h });
  if (s.session_token !== token) return NextResponse.json({ valid: false, reason: 'displaced', message: 'Your account was signed in on another device.' }, { status: 401, headers: h });
  return NextResponse.json({ valid: true }, { status: 200, headers: h });
}
