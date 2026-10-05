import type { SupabaseClient } from '@supabase/supabase-js'

// Keys written by AppCacheContext — must not survive into the next user's session
const APP_CACHE_KEYS = ['unimatch_cache', 'unimatch_cache_version']

/**
 * Signs the current user out and wipes this device's session data.
 *
 * supabase.auth.signOut() (global scope) returns an error WITHOUT clearing the
 * local session when the server call fails (e.g. flaky network), which left
 * users still signed in. We fall back to a local sign-out so the session
 * cookies are always removed.
 */
export async function signOutAndClear(supabase: SupabaseClient<any, any, any>): Promise<void> {
  try { sessionStorage.clear() } catch { /* storage unavailable */ }
  try { APP_CACHE_KEYS.forEach(k => localStorage.removeItem(k)) } catch { /* storage unavailable */ }

  const { error } = await supabase.auth.signOut()
  if (error) {
    console.warn('Global sign-out failed, clearing local session instead:', error.message)
    const { error: localError } = await supabase.auth.signOut({ scope: 'local' })
    if (localError) throw localError
  }
}

/**
 * Full page load to /login so middleware sees the cleared cookies and no
 * in-memory React state or router cache from the previous user survives.
 */
export function redirectToLogin() {
  window.location.replace('/login')
}
