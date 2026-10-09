import React from 'react'
import { PhoneMockup } from '../components/PhoneMockup'
import { THEME } from '../types'

interface SceneProps {
  frame: number
}

export const Scene8Outro: React.FC<SceneProps> = ({ frame }) => {
  // Fade to black on the final 30 frames (0.5s)
  const isEnding = frame >= 300
  const endFade = isEnding ? Math.min((frame - 300) / 30, 1) : 0

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
      {/* Background ambient purple bloom */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.4) 0%, rgba(236, 72, 153, 0.25) 50%, transparent 75%)',
          filter: 'blur(70px)',
        }}
      />

      {/* Dual Phones in V-Lockup */}
      <div
        style={{
          position: 'relative',
          width: 700,
          height: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Left Phone (Discover) */}
        <div style={{ position: 'absolute', transform: 'translateX(-120px) rotateY(18deg) scale(0.85)' }}>
          <PhoneMockup scale={0.85} rotateY={20} rotateX={6}>
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(180deg, #181230 0%, #0d091a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 60,
              }}
            >
              👩‍🎓
            </div>
          </PhoneMockup>
        </div>

        {/* Right Phone (Chat) */}
        <div style={{ position: 'absolute', transform: 'translateX(120px) rotateY(-18deg) scale(0.85)' }}>
          <PhoneMockup scale={0.85} rotateY={-20} rotateX={6}>
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(180deg, #181230 0%, #0d091a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 60,
              }}
            >
              💬
            </div>
          </PhoneMockup>
        </div>
      </div>

      {/* Outro Brand Typography & CTA */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          textAlign: 'center',
        }}
      >
        {/* Glowing UniMatch Title */}
        <h1
          style={{
            fontSize: 76,
            fontWeight: 900,
            margin: 0,
            letterSpacing: -1,
            background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #7c3aed 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 40px rgba(124, 58, 237, 0.7)',
          }}
        >
          UniMatch
        </h1>

        <p style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          Your campus is waiting.
        </p>

        {/* Link in Bio Pill */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(16px)',
            border: '1.5px solid rgba(255, 255, 255, 0.2)',
            padding: '12px 28px',
            borderRadius: 40,
            color: '#c4b5fd',
            fontSize: 18,
            fontWeight: 800,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            marginTop: 6,
          }}
        >
          uni-match-one.vercel.app · Link in bio
        </div>
      </div>

      {/* Final Beat Fade to Black */}
      {isEnding && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#000000',
            opacity: endFade,
            pointerEvents: 'none',
            zIndex: 100,
          }}
        />
      )}
    </div>
  )
}
