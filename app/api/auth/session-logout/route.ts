import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-User-Email, X-Session-Token' };
function cors() { return CORS_HEADERS; }

export async function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: cors() }); }

export async function POST(req: NextRequest) {
  const h = cors();
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
