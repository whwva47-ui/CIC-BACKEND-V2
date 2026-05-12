import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://chattersinnercircle.vercel.app';

// Supabase magic link callback -- redirects directly to /dashboard after auth
export async function GET(req: NextRequest) {
  const url  = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/dashboard';

  if (code) {
    // Supabase exchanges the code on the client side via the JS SDK
    // We just redirect to dashboard and let the client handle the session
    return NextResponse.redirect(`${SITE}/dashboard`);
  }

  // No code -- redirect to dashboard anyway (session may already exist)
  return NextResponse.redirect(`${SITE}/dashboard`);
}
