import type { SupabaseClient } from '@supabase/supabase-js'

export const UNIVERSITY_EMAIL_DOMAIN = 'kabarak.ac.ke'

/**
 * Starts Google sign-in. `hd` asks Google to only offer Kabarak accounts;
 * the domain is enforced again in /auth/callback and by a database trigger,
 * because `hd` is only a hint.
 */
export async function signInWithGoogle(supabase: SupabaseClient<any, any, any>) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        hd: UNIVERSITY_EMAIL_DOMAIN,
        prompt: 'select_account',
      },
    },
  })
  if (error) throw error
}
