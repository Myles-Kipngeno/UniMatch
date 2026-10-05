import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UNIVERSITY_EMAIL_DOMAIN = '@kabarak.ac.ke'

/**
 * OAuth (Google) return URL. Exchanges the auth code for a session cookie,
 * enforces the university email domain, then routes the user onward.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const providerError = searchParams.get('error_description') || searchParams.get('error')

  const toLogin = (reason: string) =>
    NextResponse.redirect(`${origin}/login?auth_error=${encodeURIComponent(reason)}`)

  if (providerError) {
    // e.g. the database rejected a non-university email during signup
    return toLogin(providerError)
  }
  if (!code) {
    return toLogin('Sign-in was cancelled or the link expired. Please try again.')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    return toLogin(error?.message || 'Could not complete Google sign-in.')
  }

  const email = (data.user.email || '').toLowerCase()
  if (!email.endsWith(UNIVERSITY_EMAIL_DOMAIN)) {
    await supabase.auth.signOut()
    return toLogin(`Only Kabarak University (${UNIVERSITY_EMAIL_DOMAIN}) Google accounts can join UniMatch.`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('profile_complete')
    .eq('id', data.user.id)
    .maybeSingle()

  const next = (profile as any)?.profile_complete ? '/dashboard' : '/profile?edit=true'
  return NextResponse.redirect(`${origin}${next}`)
}
