'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PasswordInput from '@/components/PasswordInput'
import GoogleSignInButton from '@/components/GoogleSignInButton'
import UniversityEmailNotice from '@/components/UniversityEmailNotice'
import { signOutAndClear } from '@/lib/auth/signOut'
import LoadingScreen from '@/components/LoadingScreen'
import './login.css'

import { useModal } from '@/components/ModalContext'

interface RememberedAccount {
  email: string
  name?: string
  avatar_url?: string
  lastUsed: number
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const modal = useModal()

  const [activeUser, setActiveUser] = useState<any>(null)
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [forceShowEmailNotice, setForceShowEmailNotice] = useState(false)

  // Errors passed back from /auth/callback (e.g. non-university Google account)
  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get('auth_error')
    if (authError) {
      setError(authError)
      if (authError.toLowerCase().includes('kabarak') || authError.toLowerCase().includes('domain')) {
        setForceShowEmailNotice(true)
      }
      window.history.replaceState(null, '', '/login')
    }
  }, [])

  useEffect(() => {
    async function checkSessionAndSaved() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setActiveUser(user)
      } catch (e) {}

      try {
        const raw = localStorage.getItem('unimatch_remembered_accounts')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            setRememberedAccounts(parsed)
          }
        }
      } catch (e) {}
    }
    checkSessionAndSaved()
  }, [])

  const handleSignOutActive = async () => {
    try {
      await signOutAndClear(supabase)
      setActiveUser(null)
      modal.toast('Signed out active session. You can now log into your account.', 'info')
    } catch (e) {
      console.error(e)
      modal.toast('Could not sign out. Please try again.', 'error')
    }
  }

  const handleSelectCard = (accEmail: string) => {
    setEmail(accEmail)
    setError('')
    modal.toast(`Filled credentials for ${accEmail}`, 'info')
    setTimeout(() => {
      const pwdInput = document.getElementById('loginPassword')
      if (pwdInput) pwdInput.focus()
    }, 50)
  }

  const handleRemoveCard = (e: React.MouseEvent, accEmail: string) => {
    e.stopPropagation()
    const updated = rememberedAccounts.filter(a => a.email.toLowerCase() !== accEmail.toLowerCase())
    setRememberedAccounts(updated)
    localStorage.setItem('unimatch_remembered_accounts', JSON.stringify(updated))
    if (email.toLowerCase() === accEmail.toLowerCase()) {
      setEmail('')
    }
    modal.toast('Removed saved account from this device.', 'info')
  }

  const handleFixEmail = (fixedEmail: string) => {
    setEmail(fixedEmail)
    setForceShowEmailNotice(false)
    setError('')
    const pwdInput = document.getElementById('loginPassword')
    if (pwdInput) pwdInput.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setUnverifiedEmail(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !password) {
      setError('Please enter both email and password.')
      setLoading(false)
      return
    }

    if (!trimmedEmail.endsWith('@kabarak.ac.ke')) {
      setForceShowEmailNotice(true)
      setError('Please use your official @kabarak.ac.ke university email.')
      setLoading(false)
      const emailInput = document.getElementById('loginEmail')
      if (emailInput) emailInput.focus()
      return
    }

    try {
      // Clear any prior active session on this device first
      sessionStorage.clear()
      await supabase.auth.signOut()

      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (loginError) {
        const msg = loginError.message.toLowerCase()
        if (msg.includes('email not confirmed') || msg.includes('confirm') || msg.includes('unverified')) {
          setUnverifiedEmail(trimmedEmail)
          setError('Email confirmation pending. Check your inbox or sign in instantly with Google below.')
        } else {
          setError(loginError.message)
        }
        setLoading(false)
        return
      }

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('name, photo_url, profile_complete, campus, course')
          .eq('id', data.user.id)
          .maybeSingle() as any

        if (profileError) {
          console.warn('Profile fetch warning on login:', profileError.message)
        }

        // Save to remembered accounts list on successful login if remember checkbox is checked
        if (remember) {
          try {
            const raw = localStorage.getItem('unimatch_remembered_accounts')
            let existing: RememberedAccount[] = raw ? JSON.parse(raw) : []
            existing = existing.filter(a => a.email.toLowerCase() !== trimmedEmail.toLowerCase())
            existing.unshift({
              email: trimmedEmail,
              name: profile?.name || trimmedEmail.split('@')[0],
              avatar_url: profile?.photo_url || '',
              lastUsed: Date.now()
            })
            localStorage.setItem('unimatch_remembered_accounts', JSON.stringify(existing.slice(0, 5)))
          } catch (e) {
            console.error('Failed saving account to localStorage', e)
          }
        }

        const isProfileComplete = Boolean(
          profile?.profile_complete || 
          (profile?.name && (profile?.photo_url || profile?.campus || profile?.course))
        )

        if (isProfileComplete) {
          router.push('/dashboard')
        } else {
          router.push('/profile')
        }
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Invalid email or password.')
      setLoading(false)
    }
  }

  const handleResend = async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      modal.toast('Please enter your email address.', 'warning')
      return
    }
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
        }
      })
      if (resendErr) throw resendErr
      modal.alert({
        title: 'Verification Sent 🎉',
        message: 'Verification email resent! Please check your SPAM or inbox folder.',
        type: 'success'
      })
    } catch (err: any) {
      modal.alert({
        title: 'Resend Failed',
        message: err.message || 'Failed to resend verification email.',
        type: 'error'
      })
    }
  }

  if (loading) {
    return <LoadingScreen message="Setting up your session..." />
  }

  return (
    <div className="login-page">
      <div className="container">
        <form id="loginForm" className="card" onSubmit={handleSubmit} method="post" autoComplete="on">
          <h2>Welcome Back 🩵</h2>
          <p>Login to your account</p>

          {activeUser && (
            <div style={{
              background: 'var(--surface-2, rgba(108,71,255,0.08))',
              border: '1px solid var(--violet, #6c47ff)',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '16px',
              fontSize: '13px',
              textAlign: 'left',
              color: 'var(--ink)'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                👤 Logged in as: {activeUser.email}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px' }}>
                Not you? Log in below or switch accounts.
              </div>
              <button 
                type="button" 
                onClick={handleSignOutActive}
                style={{
                  background: 'var(--violet, #6c47ff)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Sign Out &amp; Switch Account
              </button>
            </div>
          )}

          {/* Remembered Account Cards */}
          {rememberedAccounts.length > 0 && (
            <div className="saved-accounts-section">
              <div className="saved-accounts-title">
                <span>Saved Accounts</span>
                <span className="saved-accounts-sub">Tap card to fill credentials</span>
              </div>
              <div className="saved-accounts-grid">
                {rememberedAccounts.map((acc) => {
                  const isSelected = email.toLowerCase() === acc.email.toLowerCase()
                  return (
                    <div 
                      key={acc.email} 
                      className={`account-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectCard(acc.email)}
                    >
                      <div className="account-card-avatar">
                        {acc.avatar_url ? (
                          <img src={acc.avatar_url} alt={acc.name || acc.email} />
                        ) : (
                          <div className="avatar-fallback">
                            {(acc.name || acc.email)[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="account-card-info">
                        <div className="account-card-name">{acc.name || acc.email.split('@')[0]}</div>
                        <div className="account-card-email">{acc.email}</div>
                      </div>
                      <button 
                        type="button" 
                        className="remove-card-btn" 
                        title="Forget this account"
                        onClick={(e) => handleRemoveCard(e, acc.email)}
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <input
            type="email"
            id="loginEmail"
            name="username"
            autoComplete="username"
            placeholder="University Email (@kabarak.ac.ke)"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (forceShowEmailNotice && e.target.value.toLowerCase().endsWith('@kabarak.ac.ke')) {
                setForceShowEmailNotice(false)
                setError('')
              }
            }}
            required
          />

          <UniversityEmailNotice
            email={email}
            onFixEmail={handleFixEmail}
            forceShow={forceShowEmailNotice}
          />
          <PasswordInput
            id="loginPassword"
            name="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '13px', color: '#9e9bb8', textAlign: 'left' }}>
            <input
              type="checkbox"
              id="rememberMe"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
            />
            <label htmlFor="rememberMe" style={{ cursor: 'pointer', userSelect: 'none' }}>
              Save account card on this device
            </label>
          </div>

          {error && <p id="loginError" className="error">{error}</p>}

          {unverifiedEmail && (
            <div style={{
              margin: '14px 0',
              padding: '14px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '14px',
              textAlign: 'left'
            }}>
              <p style={{ color: '#fbbf24', fontSize: '13px', margin: '0 0 10px 0', lineHeight: 1.5, fontWeight: 500 }}>
                ⚠️ <strong>Email confirmation pending for {unverifiedEmail}.</strong> Check your inbox / spam folder or resend below.
              </p>
              <button
                type="button"
                id="resendBtn"
                className="btn-secondary"
                onClick={handleResend}
                style={{ marginBottom: '10px', width: '100%', padding: '10px' }}
              >
                Resend verification email
              </button>
              <div style={{
                textAlign: 'center',
                paddingTop: '10px',
                borderTop: '1px dashed rgba(255, 255, 255, 0.12)'
              }}>
                <div style={{ fontSize: '12px', color: '#c4b5fd', marginBottom: '8px' }}>
                  ⚡ <strong>Skip waiting?</strong> Sign in with Google:
                </div>
                <GoogleSignInButton label="Sign in instantly with Kabarak Google" />
              </div>
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <GoogleSignInButton />

          <p className="switch">
            New here?{' '}
            <Link href="/signup">Join now</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
