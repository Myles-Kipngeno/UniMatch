'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PasswordInput from '@/components/PasswordInput'
import GoogleSignInButton from '@/components/GoogleSignInButton'
import LoadingScreen from '@/components/LoadingScreen'
import './signup.css'

import { useModal } from '@/components/ModalContext'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const modal = useModal()

  const KABARAK_DOMAIN = '@kabarak.ac.ke'
  const UNIVERSITY_NAME = 'Kabarak University'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [emailHelper, setEmailHelper] = useState('')
  const [loading, setLoading] = useState(false)
  // Set after a successful signup: shows the "check your email" panel with Resend
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleEmailChange = (val: string) => {
    setEmail(val)
    const lowerVal = val.toLowerCase().trim()
    if (lowerVal.length > 0 && !lowerVal.includes('@')) {
      setEmailHelper(`Use your ${UNIVERSITY_NAME} email: ${lowerVal}${KABARAK_DOMAIN}`)
    } else {
      setEmailHelper('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()

    // 1️⃣ Check Kabarak University email ONLY
    if (!trimmedEmail.endsWith(KABARAK_DOMAIN)) {
      setError(`Only ${UNIVERSITY_NAME} email addresses (${KABARAK_DOMAIN}) are allowed.`)
      setLoading(false)
      return
    }

    // 2️⃣ Validate email format
    const emailRegex = /^[a-zA-Z0-9._-]+@kabarak\.ac\.ke$/
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid Kabarak University email address.')
      setLoading(false)
      return
    }

    // 3️⃣ Check password strength
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      setLoading(false)
      return
    }

    // 4️⃣ Check password match
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    try {
      // Clear any prior active session on this device first
      sessionStorage.clear()
      await supabase.auth.signOut()

      // 5️⃣ Create user in Supabase Auth
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            name: trimmedName,
            university: UNIVERSITY_NAME,
            email_domain: KABARAK_DOMAIN,
          },
        },
      })

      if (signUpErr) throw signUpErr

      const user = data.user

      // 6️⃣ Upsert profile data in PostgreSQL.
      // The signup trigger already creates the profile; with email confirmation on there's
      // no session yet, so RLS can reject this — that must not fail an otherwise good signup.
      if (user && data.session) {
        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email!,
          name: trimmedName,
          university: UNIVERSITY_NAME,
          email_domain: KABARAK_DOMAIN,
          profile_complete: false,
        } as any)
        if (upsertErr) console.warn('Profile upsert after signup:', upsertErr.message)
      }

      setSignedUpEmail(trimmedEmail)
      setResendCooldown(60)
      setLoading(false)
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'An error occurred during signup. Please try again.')
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!signedUpEmail || resendCooldown > 0 || resending) return
    setResending(true)
    try {
      const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email: signedUpEmail })
      if (resendErr) throw resendErr
      modal.toast('Confirmation email sent again — check your inbox and spam folder.', 'success')
      setResendCooldown(60)
    } catch (err: any) {
      modal.toast(err.message || 'Could not resend the email. Try again shortly.', 'error')
    } finally {
      setResending(false)
    }
  }

  if (loading) {
    return <LoadingScreen message="Creating your account..." />
  }

  if (signedUpEmail) {
    return (
      <div className="signup-page">
        <div className="container">
          <div className="card" style={{ textAlign: 'center' }}>
            <h2>Check your email 📬</h2>
            <p>
              We sent a confirmation link to <strong>{signedUpEmail}</strong>.
              Open it to activate your account, then log in.
            </p>
            <button
              type="button"
              className="secondary-action"
              onClick={handleResendConfirmation}
              disabled={resendCooldown > 0 || resending}
              style={{ width: '100%', minHeight: '46px', margin: '8px 0 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 600, cursor: resendCooldown > 0 || resending ? 'not-allowed' : 'pointer', opacity: resendCooldown > 0 || resending ? 0.6 : 1 }}
            >
              {resending ? 'Sending…' : resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : 'Resend confirmation email'}
            </button>
            <button type="submit" onClick={() => router.push('/login')}>
              Go to Login
            </button>
            <p className="switch">
              Wrong email?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setSignedUpEmail(null) }}>Sign up again</a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="signup-page">
      <div className="container">
        <form id="signupForm" className="card" onSubmit={handleSubmit}>
          <h2>Create Account 💕</h2>
          <p>University students only</p>

          <input
            type="text"
            id="name"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            id="email"
            placeholder="University Email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            required
          />
          {emailHelper && (
            <small id="emailHelper" style={{ color: '#667eea', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              {emailHelper}
            </small>
          )}

          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {confirmPassword.length > 0 && (
            <small className="password-match-hint" style={{ display: 'block', marginTop: '-8px', marginBottom: '12px', fontSize: '12px', textAlign: 'left', color: password === confirmPassword ? '#10b981' : '#f87171' }}>
              {password === confirmPassword ? '✓ Passwords match' : 'Passwords do not match yet'}
            </small>
          )}

          {error && <p id="error" className="error" style={{ display: 'block' }}>{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>

          <GoogleSignInButton label="Sign up with Google" />

          <p className="switch">
            Already have an account?{' '}
            <Link href="/login">Login</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
