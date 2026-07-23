'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [emailHelper, setEmailHelper] = useState('')
  const [loading, setLoading] = useState(false)

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

      // 6️⃣ Upsert profile data in PostgreSQL
      if (user) {
        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email!,
          name: trimmedName,
          university: UNIVERSITY_NAME,
          email_domain: KABARAK_DOMAIN,
          profile_complete: false,
        })
        if (upsertErr) throw upsertErr
      }

      modal.alert({
        title: 'Account Created 🎉',
        message: `Please check your ${UNIVERSITY_NAME} email to verify your account before logging in.`,
        type: 'success',
        onClose: () => router.push('/login')
      })
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'An error occurred during signup. Please try again.')
      setLoading(false)
    }
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

          <div className="password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
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

          <div className="password-wrapper">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <i
              className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}
              id="toggleConfirmPassword"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{ cursor: 'pointer' }}
            ></i>
          </div>

          {error && <p id="error" className="error" style={{ display: 'block' }}>{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>

          <p className="switch">
            Already have an account?{' '}
            <Link href="/login">Login</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
