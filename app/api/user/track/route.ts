import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const OPEN = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-User-Email' };

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: OPEN }); }

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const email = (b.email || req.headers.get('X-User-Email') || '').trim().toLowerCase();
    if (!email.includes('@')) return NextResponse.json({ success: false }, { headers: OPEN });
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await db.from('usage_logs').insert({ email, action: b.action || 'generate', platform: b.platform || 'unknown', created_at: new Date().toISOString() });
  } catch { /* non-fatal */ }
  return NextResponse.json({ success: true }, { headers: OPEN });
}
