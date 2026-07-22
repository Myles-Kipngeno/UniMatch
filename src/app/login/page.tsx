'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import './login.css'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [verifyNotice, setVerifyNotice] = useState(false)
  const [resendBtn, setResendBtn] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setVerifyNotice(false)
    setResendBtn(false)
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (authError) throw authError

      const user = data.user

      // Check if email confirmation is required
      if (user && user.email_confirmed_at === null && !user.email_confirmed) {
        setError('Please verify your email before logging in.')
        setVerifyNotice(true)
        setResendBtn(true)
        setLoading(false)
        return
      }

      sessionStorage.setItem('authenticated', 'true')
      router.refresh()
      router.push('/dashboard')
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Invalid email or password.')
      setLoading(false)
    }
  }

  const handleResend = async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      alert('Please enter your email address.')
      return
    }
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
      })
      if (resendErr) throw resendErr
      alert('Verification email resent! Check your SPAM or inbox folder.')
    } catch (err: any) {
      alert(err.message || 'Failed to resend verification email.')
    }
  }

  return (
    <div className="login-page">
      <div className="container">
        <form id="loginForm" className="card" onSubmit={handleSubmit}>
          <h2>Welcome Back 🩵</h2>
          <p>Login to your account</p>

          <input
            type="email"
            id="loginEmail"
            placeholder="University Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="loginPassword"
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

          {error && <p id="loginError" className="error">{error}</p>}

          {verifyNotice && (
            <p id="verifyNotice" style={{ color: 'orange' }}>
              Your email is not verified.
            </p>
          )}

          {resendBtn && (
            <button type="button" id="resendBtn" onClick={handleResend} style={{ marginBottom: '1rem' }}>
              Resend verification email
            </button>
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
