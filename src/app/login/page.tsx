'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)

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
      sessionStorage.clear()
      await supabase.auth.signOut()
      setActiveUser(null)
      modal.toast('Signed out active session. You can now log into your account.', 'info')
    } catch (e) {
      console.error(e)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setUnverifiedEmail(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Please enter both email and password.')
      setLoading(false)
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
          setError('Email not confirmed. Please check your inbox or click resend below.')
        } else {
          setError(loginError.message)
        }
        setLoading(false)
        return
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, avatar_url, profile_complete')
          .eq('id', data.user.id)
          .single() as any

        // Save to remembered accounts list on successful login if remember checkbox is checked
        if (remember) {
          try {
            const raw = localStorage.getItem('unimatch_remembered_accounts')
            let existing: RememberedAccount[] = raw ? JSON.parse(raw) : []
            existing = existing.filter(a => a.email.toLowerCase() !== trimmedEmail.toLowerCase())
            existing.unshift({
              email: trimmedEmail,
              name: profile?.name || trimmedEmail.split('@')[0],
              avatar_url: profile?.avatar_url || '',
              lastUsed: Date.now()
            })
            localStorage.setItem('unimatch_remembered_accounts', JSON.stringify(existing.slice(0, 5)))
          } catch (e) {
            console.error('Failed saving account to localStorage', e)
          }
        }

        router.push('/dashboard')
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
            placeholder="University Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="loginPassword"
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <i
              className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}
              id="togglePassword"
              onClick={() => setShowPassword(!showPassword)}
              style={{ cursor: 'pointer' }}
            ></i>
          </div>

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
            <>
              <p id="verifyNotice" style={{ color: 'orange', fontSize: '13.5px', marginBottom: '8px' }}>
                Your email is not verified yet.
              </p>
              <button type="button" id="resendBtn" className="btn-secondary" onClick={handleResend} style={{ marginBottom: '1rem', width: '100%' }}>
                Resend verification email
              </button>
            </>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <p className="switch">
            New here?{' '}
            <Link href="/signup">Join now</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
