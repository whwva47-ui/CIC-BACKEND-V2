import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://chattersinnercircle.vercel.app';

export async function GET(req: NextRequest) {
  // Supabase handles the token exchange — redirect to landing with params preserved
  const url = new URL(req.url);
  const redirectTo = `${SITE}/landing${url.search}`;
  return NextResponse.redirect(redirectTo);
}
