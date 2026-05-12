import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const PLATFORM = ['chrome-extension://dkgpheiimhedhdfandcgeogmbfmmiobp','https://chattersinnercircle.vercel.app','https://chattersinnercircle.vercel.app','https://chathomebase.com','https://www.chathomebase.com','https://alpha.date','https://www.alpha.date','https://onlyfans.com','https://fansly.com','https://loyalfans.com','https://fancentro.com','https://admireme.vip','https://fanvue.com','https://www.manyvids.com','https://unlockd.com','http://localhost:3000'];
function cors(o: string|null) { const r = o && PLATFORM.includes(o) ? o : PLATFORM[1]; return { 'Access-Control-Allow-Origin': r, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-User-Email' }; }

const LABELS: Record<string,string> = { mpesa: 'M-Pesa', card: 'Card', paypal: 'PayPal', crypto: 'Crypto' };

export async function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) }); }

export async function POST(req: NextRequest) {
  const h = cors(req.headers.get('origin'));
  let email = '', paymentMethod = '', requestType = 'upgrade';
  try { const b = await req.json(); email = (b.email || req.headers.get('X-User-Email') || '').trim().toLowerCase(); paymentMethod = (b.paymentMethod || '').trim().toLowerCase(); requestType = (b.requestType || 'upgrade').trim().toLowerCase(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: h }); }
  if (!email.includes('@')) return NextResponse.json({ error: 'Valid email required.' }, { status: 400, headers: h });

  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await db.from('pro_requests').insert({ email, payment_method: paymentMethod || null, request_type: requestType, status: 'pending' });
  } catch (e) { console.error('[pro/request]', e); }

  const webhook = process.env.ADMIN_WEBHOOK_URL || '';
  if (webhook) {
    try { await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: requestType, email, paymentMethod: LABELS[paymentMethod] ?? paymentMethod, timestamp: new Date().toISOString() }) }); }
    catch { /* non-fatal */ }
  }

  return NextResponse.json({ success: true, message: requestType === 'multi_device' ? 'Request sent. Admin will contact you shortly.' : `Admin will send ${LABELS[paymentMethod] ?? 'payment'} details shortly.` }, { headers: h });
}
