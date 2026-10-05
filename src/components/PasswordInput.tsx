'use client'

import { useState, type InputHTMLAttributes } from 'react'
import './PasswordInput.css'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * Password field with a show/hide eye button.
 * The icon is inline SVG (no icon-font dependency) and the toggle is a real
 * <button>, so it's visible, keyboard accessible and labelled for screen readers.
 */
export default function PasswordInput({ className, ...inputProps }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const label = visible ? 'Hide password' : 'Show password'

  return (
    <div className="um-pw-field">
      <input
        {...inputProps}
        type={visible ? 'text' : 'password'}
        className={`um-pw-input ${className || ''}`.trim()}
      />
      <button
        type="button"
        className="um-pw-toggle"
        onClick={() => setVisible(v => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
      >
        {visible ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}
