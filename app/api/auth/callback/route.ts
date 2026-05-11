import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://chattersinnercircle.vercel.app'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)

  const code = url.searchParams.get('code')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${SITE}/dashboard`)
}
