import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const OPEN = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-User-Email' };

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: OPEN }); }

export async function GET(req: NextRequest) {
  const email = (req.headers.get('X-User-Email') || '').trim().toLowerCase();
  if (!email.includes('@')) return NextResponse.json({ error: 'X-User-Email header required.' }, { status: 400, headers: OPEN });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: p } = await db.from('profiles').select('id,email,plan,plan_status,daily_generations,max_daily_generations,total_generations,trial_ends_at,plan_expires_at').eq('email', email).maybeSingle();
  if (!p) return NextResponse.json({ error: 'Profile not found.' }, { status: 404, headers: OPEN });

  const remaining = p.plan === 'pro' ? 999999 : Math.max(0, (p.max_daily_generations || 10) - (p.daily_generations || 0));
  return NextResponse.json({ ...p, remaining }, { headers: OPEN });
}
