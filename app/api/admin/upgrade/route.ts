import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const OPEN = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: OPEN }); }

export async function POST(req: NextRequest) {
  let email = '', plan = '', adminKey = '';
  try { const b = await req.json(); email = (b.email||'').trim().toLowerCase(); plan = (b.plan||'').trim(); adminKey = b.adminKey || ''; }
  catch { return NextResponse.json({ error: 'Invalid.' }, { status: 400, headers: OPEN }); }

  if (adminKey !== process.env.ADMIN_SECRET_KEY) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: OPEN });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const updates: Record<string,unknown> = { plan, plan_status: 'approved' };
  if (plan === 'pro') { updates.max_daily_generations = 999999; updates.explicit_enabled = true; updates.plan_expires_at = new Date(Date.now() + 30*24*60*60*1000).toISOString(); }
  else if (plan === 'basic') { updates.max_daily_generations = 50; updates.explicit_enabled = false; updates.plan_expires_at = new Date(Date.now() + 30*24*60*60*1000).toISOString(); }

  const { error } = await db.from('profiles').update(updates).eq('email', email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: OPEN });
  return NextResponse.json({ success: true, email, plan }, { headers: OPEN });
}
