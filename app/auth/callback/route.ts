import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  const supabase = await createClient()
  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError) {
    console.error('Session exchange error:', sessionError.message)
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  // Check if profile row exists (created by DB trigger automatically)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', user.id)
    .single()

  if (!existingProfile) {
    // Trigger didn't fire or race condition: create the profile ourselves
    await supabase.from('profiles').upsert({
      id: user.id,
      full_name: user.user_metadata?.full_name ?? '',
      avatar_url: user.user_metadata?.avatar_url ?? '',
    }, { onConflict: 'id' })

    // New user: send to onboarding to pick a username
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  if (!existingProfile.username) {
    // Profile exists but no username yet → onboarding
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  // Profile exists and has username → go to dashboard
  return NextResponse.redirect(`${origin}${next}`)
}
