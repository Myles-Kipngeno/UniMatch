'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import './login.css'

import { useModal } from '@/components/ModalContext'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const modal = useModal()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)

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
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (loginError) {
        if (loginError.message.toLowerCase().includes('email not confirmed')) {
          setUnverifiedEmail(trimmedEmail)
          setError('Email not confirmed. Please verify your email first.')
        } else {
          setError(loginError.message)
        }
        setLoading(false)
        return
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('profile_complete')
          .eq('id', data.user.id)
          .single()

        if (profile && profile.profile_complete) {
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
