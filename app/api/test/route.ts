import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const results: any = {};

  results.SUPABASE_URL     = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  results.SERVICE_ROLE_KEY = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  results.GROQ_KEY         = !!process.env.GROQ_API_KEY;
  results.GOOGLE_KEY       = !!process.env.GOOGLE_AI_API_KEY;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await sb.from('profiles').select('count').limit(1);
    results.supabase = error ? 'ERROR: ' + error.message : 'OK';
  } catch (e: any) { results.supabase = 'CRASH: ' + e.message; }

  try {
    const key = process.env.GROQ_API_KEY || '';
    if (!key) { results.groq = 'NO KEY'; } else {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 10, messages: [{ role: 'user', content: 'Say OK' }] })
      });
      const d = await res.json();
      results.groq = res.ok ? 'OK' : 'ERROR ' + res.status + ' ' + JSON.stringify(d).slice(0, 200);
    }
  } catch (e: any) { results.groq = 'CRASH: ' + e.message; }

  try {
    const key = process.env.GOOGLE_AI_API_KEY || '';
    if (!key) { results.google = 'NO KEY'; } else {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Say OK' }] }], generationConfig: { maxOutputTokens: 10 } })
      });
      const d = await res.json();
      results.google = res.ok ? 'OK' : 'ERROR ' + res.status + ' ' + JSON.stringify(d).slice(0, 200);
    }
  } catch (e: any) { results.google = 'CRASH: ' + e.message; }

  return NextResponse.json(results, { status: 200 });
}
