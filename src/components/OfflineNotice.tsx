'use client'

import React from 'react'
import { useNetwork } from '@/context/NetworkContext'

/** Global offline/reconnected banner — rendered once in Providers */
export function GlobalOfflineBanner() {
  const { isOnline, showReconnected } = useNetwork()

  if (isOnline && !showReconnected) return null

  if (showReconnected) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          backgroundColor: '#22c55e',
          color: '#ffffff',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 600,
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          zIndex: 99999,
          boxShadow: '0 2px 10px rgba(34, 197, 94, 0.3)',
          animation: 'slideDownBanner 0.3s ease-out',
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span>Back online ✓</span>
      </div>
    )
  }

  // Offline banner
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        backgroundColor: '#ef4444',
        color: '#ffffff',
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: 600,
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        zIndex: 99999,
        boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)',
        animation: 'slideDownBanner 0.3s ease-out',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <span>You&apos;re offline — showing your last saved data</span>
    </div>
  )
}

interface OfflineNoticeProps {
  onRetry?: () => void
  isBannerOnly?: boolean
  message?: string
}

/** Standalone banner (for per-page usage — kept for backward compat) */
export function OfflineBanner() {
  return (
    <div
      style={{
        width: '100%',
        backgroundColor: '#ef4444',
        color: '#ffffff',
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: 600,
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        position: 'sticky',
        top: 0,
        zIndex: 999,
        boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <span>You&apos;re offline. Displaying cached data.</span>
    </div>
  )
}

/** Full-page offline notice (for pages with no cached data at all) */
export default function OfflineNotice({ onRetry, isBannerOnly = false, message }: OfflineNoticeProps) {
  if (isBannerOnly) {
    return <OfflineBanner />
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        minHeight: '320px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          color: '#f87171',
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>

      <h3
        style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#ffffff',
          margin: '0 0 8px 0',
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        No Internet Connection
      </h3>

      <p
        style={{
          fontSize: '14px',
          color: '#9ca3af',
          margin: '0 0 24px 0',
          maxWidth: '320px',
          lineHeight: '1.5',
        }}
      >
        {message || 'Unable to connect to UniMatch servers. Please check your connection and try again.'}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '12px 28px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6c47ff 0%, #a855f7 100%)',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(108, 71, 255, 0.4)',
            transition: 'transform 0.15s ease, opacity 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          Try Again
        </button>
      )}
    </div>
  )
}
