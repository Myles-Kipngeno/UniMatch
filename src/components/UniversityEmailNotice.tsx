'use client'

import React from 'react'
import './UniversityEmailNotice.css'

export const KABARAK_EMAIL_DOMAIN = '@kabarak.ac.ke'

export function isPersonalEmail(emailStr: string): boolean {
  const trimmed = (emailStr || '').trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@')) return false

  const atIdx = trimmed.indexOf('@')
  const domain = trimmed.slice(atIdx + 1)
  if (!domain) return false

  // If it already ends with @kabarak.ac.ke (or kabarak.ac.ke), it's valid
  if (domain === 'kabarak.ac.ke' || domain.endsWith('.kabarak.ac.ke')) {
    return false
  }

  // Common personal email providers or any domain with dot that isn't kabarak
  const knownPersonal = [
    'gmail', 'yahoo', 'outlook', 'hotmail', 'icloud', 'proton',
    'live', 'aol', 'mail', 'yandex', 'zoho', 'msn', 'googlemail'
  ]

  const startsWithPersonal = knownPersonal.some(p => domain.startsWith(p))
  const hasCompletedDomain = domain.includes('.')

  return startsWithPersonal || hasCompletedDomain
}

export function getSuggestedEmail(emailStr: string): string | null {
  const trimmed = (emailStr || '').trim()
  if (!trimmed || !trimmed.includes('@')) return null
  const localPart = trimmed.split('@')[0]
  if (!localPart) return null
  return `${localPart}@kabarak.ac.ke`
}

interface UniversityEmailNoticeProps {
  email: string
  onFixEmail?: (fixedEmail: string) => void
  forceShow?: boolean
  className?: string
}

export default function UniversityEmailNotice({
  email,
  onFixEmail,
  forceShow = false,
  className = ''
}: UniversityEmailNoticeProps) {
  const personal = isPersonalEmail(email)
  const shouldShow = forceShow || personal

  if (!shouldShow) return null

  const suggested = getSuggestedEmail(email)

  return (
    <div className={`uni-email-alert ${className}`.trim()} role="alert">
      <div className="uni-email-alert-top">
        <div className="uni-email-alert-badge">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>University Email Required</span>
        </div>
        <span className="uni-email-domain-tag">@kabarak.ac.ke</span>
      </div>

      <p className="uni-email-alert-text">
        UniMatch is exclusively for <strong>Kabarak University</strong> students. Please use your official university email ending in <strong>@kabarak.ac.ke</strong> instead of personal email addresses.
      </p>

      {suggested && onFixEmail && (
        <button
          type="button"
          className="uni-email-fix-btn"
          onClick={() => onFixEmail(suggested)}
          title={`Switch to ${suggested}`}
        >
          <span className="fix-btn-icon">⚡</span>
          <span className="fix-btn-text">
            Switch to <strong>{suggested}</strong>
          </span>
          <span className="fix-btn-arrow">→</span>
        </button>
      )}
    </div>
  )
}
