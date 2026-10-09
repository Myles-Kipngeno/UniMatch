import React from 'react'
import { PhoneMockup } from '../components/PhoneMockup'
import { THEME } from '../types'

interface SceneProps {
  frame: number
}

export const Scene2Verification: React.FC<SceneProps> = ({ frame }) => {
  // Pacing: frame 0 to 310
  // Phone whips up: frame 0 to 60
  const introProgress = Math.min(frame / 50, 1)
  const phoneY = 300 * (1 - introProgress)
  const rotX = 25 * (1 - introProgress * 0.6)
  const rotY = -30 + introProgress * 45 // settles around +15

  // Typing email animation: frames 50 to 140
  const emailText = 'alex.mutua@uonbi.ac.ke'
  const typingChars = Math.floor(Math.max(0, (frame - 50) / 4))
  const displayedEmail = emailText.slice(0, typingChars)

  // Verified badge pops up at frame 150
  const isVerified = frame >= 150
  const badgeScale = isVerified ? (frame < 170 ? 1.25 : 1.0) : 0
  const glint = isVerified ? Math.min((frame - 150) / 40, 1) : 0

  // Catfish rejected cards at frame 230
  const showReject = frame >= 220

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: THEME.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient gradient */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(124, 58, 237, 0.15) 50%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Top Banner Tag */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          zIndex: 50,
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: '12px 28px',
          borderRadius: 40,
          color: '#ffffff',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: 'uppercase',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        }}
      >
        Verified Students Only
      </div>

      {/* 3D Phone Mockup */}
      <PhoneMockup
        translateY={phoneY}
        rotateX={rotX}
        rotateY={rotY}
        glintProgress={glint}
        scale={1.12}
      >
        {/* Verification UI Screen */}
        <div
          style={{
            padding: '70px 24px 20px',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            background: 'linear-gradient(180deg, #120e24 0%, #0b0914 100%)',
            color: '#ffffff',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 24, margin: '0 0 6px', fontWeight: 800 }}>Campus Verification</h2>
            <p style={{ fontSize: 13, color: THEME.gray, margin: 0 }}>
              Connect using your university email
            </p>
          </div>

          {/* Email Input Field */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1.5px solid rgba(124, 58, 237, 0.4)',
              borderRadius: 16,
              padding: '16px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 20 }}>🎓</span>
            <div style={{ fontSize: 15, fontFamily: 'monospace', color: '#e2e8f0' }}>
              {displayedEmail}
              {frame % 30 < 15 && <span style={{ color: THEME.neonViolet }}>|</span>}
            </div>
          </div>

          {/* 3D Z-Lift Verified Badge */}
          {isVerified && (
            <div
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                borderRadius: 18,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transform: `scale(${badgeScale})`,
                boxShadow: '0 10px 30px rgba(16, 185, 129, 0.5)',
                transition: 'transform 0.2s cubic-bezier(0.17, 0.89, 0.32, 1.49)',
              }}
            >
              <span style={{ fontSize: 22 }}>✓</span>
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>
                STUDENT VERIFIED (.AC.KE)
              </span>
            </div>
          )}

          {/* Rejected Catfish & Fake Cards (On "No randoms. No catfish.") */}
          {showReject && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginTop: 10,
              }}
            >
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1.5px solid rgba(239, 68, 68, 0.5)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: '#fca5a5',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <span>🚫 Non-Student Account</span>
                <span style={{ color: '#ef4444', fontWeight: 800 }}>BLOCKED</span>
              </div>

              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1.5px solid rgba(239, 68, 68, 0.5)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: '#fca5a5',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <span>🐟 Unverified Catfish</span>
                <span style={{ color: '#ef4444', fontWeight: 800 }}>REJECTED</span>
              </div>
            </div>
          )}
        </div>
      </PhoneMockup>
    </div>
  )
}
