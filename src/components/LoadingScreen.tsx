'use client'

import { useState, useEffect } from 'react'

const DEFAULT_TAGLINES = [
  "Finding your people...",
  "Almost there...",
  "Getting things ready...",
  "Connecting campus vibes..."
]

interface LoadingScreenProps {
  message?: string
  fullScreen?: boolean
}

export default function LoadingScreen({ message, fullScreen = true }: LoadingScreenProps) {
  const [taglineIndex, setTaglineIndex] = useState(0)

  useEffect(() => {
    if (message) return
    const interval = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % DEFAULT_TAGLINES.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [message])

  const displayMessage = message || DEFAULT_TAGLINES[taglineIndex]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: fullScreen ? '100vh' : '100%',
        height: fullScreen ? '100vh' : 'auto',
        width: '100%',
        backgroundColor: '#0f0e17',
        color: '#ffffff',
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: '32px 20px',
        boxSizing: 'border-box',
        zIndex: fullScreen ? 9999 : 1,
        position: fullScreen ? 'fixed' : 'relative',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <style>{`
        @keyframes heartbeat {
          0% { transform: scale(1); }
          12% { transform: scale(1.12); }
          24% { transform: scale(1); }
          36% { transform: scale(1.08); }
          48% { transform: scale(1); }
          100% { transform: scale(1); }
        }
        @keyframes ringExpand {
          0% { transform: scale(0.85); opacity: 0.7; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes pulseDot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes fadeInOutText {
          0% { opacity: 0.3; transform: translateY(2px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0.3; transform: translateY(-2px); }
        }
      `}</style>

      {/* Logo Container with Ring */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
        {/* Expanding Ring */}
        <div
          style={{
            position: 'absolute',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(244,114,182,0.4) 0%, rgba(108,71,255,0.2) 60%, transparent 100%)',
            animation: 'ringExpand 2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Logo Image */}
        <img
          src="/Unimatch_icon.png"
          alt="UniMatch"
          style={{
            width: '52px',
            height: '52px',
            objectFit: 'contain',
            borderRadius: '14px',
            animation: 'heartbeat 2s ease-in-out infinite',
            filter: 'drop-shadow(0 6px 20px rgba(108,71,255,0.45))',
          }}
        />
      </div>

      {/* Brand Title */}
      <h2
        style={{
          margin: '0 0 8px 0',
          fontSize: '22px',
          fontWeight: '800',
          letterSpacing: '-0.5px',
          background: 'linear-gradient(135deg, #ffffff 0%, #e0d7ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        UniMatch
      </h2>

      {/* Rotating / Custom Tagline */}
      <p
        key={displayMessage}
        style={{
          margin: '0 0 16px 0',
          fontSize: '14px',
          fontWeight: '500',
          color: '#a78bfa',
          textAlign: 'center',
          animation: message ? 'none' : 'fadeInOutText 2.2s ease-in-out infinite',
        }}
      >
        {displayMessage}
      </p>

      {/* Three Sequential Pulsing Dots */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#6c47ff',
            animation: 'pulseDot 1.4s infinite 0s',
          }}
        />
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#a855f7',
            animation: 'pulseDot 1.4s infinite 0.2s',
          }}
        />
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#f472b6',
            animation: 'pulseDot 1.4s infinite 0.4s',
          }}
        />
      </div>
    </div>
  )
}
