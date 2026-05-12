import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const AUTH = ['chrome-extension://dkgpheiimhedhdfandcgeogmbfmmiobp','https://chattersinnercircle.vercel.app','https://chattersinnercircle.vercel.app','http://localhost:3000'];
function cors(o: string|null) { const r = o && AUTH.includes(o) ? o : AUTH[0]; return { 'Access-Control-Allow-Origin': r, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }; }

export async function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) }); }

export async function POST(req: NextRequest) {
  const h = cors(req.headers.get('origin'));
  try {
    const b = await req.json();
    const email = (b.email || '').trim().toLowerCase();
    const token = (b.session_token || '').trim();
    if (email && token) {
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await db.from('active_sessions').delete().eq('email', email).eq('session_token', token);
    }
  } catch { /* always succeed */ }
  return NextResponse.json({ success: true }, { headers: h });
}
