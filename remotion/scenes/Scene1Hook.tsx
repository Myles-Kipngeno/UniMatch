import React from 'react'
import { THEME } from '../types'

interface SceneProps {
  frame: number
}

export const Scene1Hook: React.FC<SceneProps> = ({ frame }) => {
  // Pacing: 0 to 205 frames
  // Word 1: "Okay, real talk..." at frame 0
  // Word 2: "how many people" at frame 40
  // Word 3: "have you" at frame 80
  // Word 4: "ACTUALLY" at frame 120 (big overshoot)
  // Word 5: "met?" at frame 150

  const glowScale = Math.min(1 + frame * 0.008, 2.5)
  const isActuallyTriggered = frame >= 120

  // 6-frame camera shake around frame 150-160
  const isShaking = frame >= 150 && frame <= 165
  const shakeX = isShaking ? (frame % 2 === 0 ? 8 : -8) : 0
  const shakeY = isShaking ? (frame % 3 === 0 ? -6 : 6) : 0

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
        padding: '0 60px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      {/* Center glowing epicenter */}
      <div
        style={{
          position: 'absolute',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.45) 0%, rgba(236, 72, 153, 0.2) 40%, transparent 70%)',
          filter: 'blur(40px)',
          transform: `scale(${glowScale})`,
          transition: 'transform 0.1s linear',
        }}
      />

      {/* Kinetic text sequence */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          zIndex: 10,
          textAlign: 'center',
        }}
      >
        {frame >= 10 && (
          <span
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: THEME.neonViolet,
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}
          >
            Okay, Real Talk...
          </span>
        )}

        {frame >= 40 && (
          <span
            style={{
              fontSize: 54,
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.15,
            }}
          >
            how many people on campus
          </span>
        )}

        {frame >= 85 && (
          <span
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: '#cbd5e1',
            }}
          >
            have you
          </span>
        )}

        {isActuallyTriggered && (
          <span
            style={{
              fontSize: 130,
              fontWeight: 900,
              lineHeight: 0.95,
              letterSpacing: -2,
              background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #7c3aed 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 40px rgba(236, 72, 153, 0.6)',
              transform: frame < 135 ? 'scale(1.25)' : 'scale(1.0)',
              transition: 'transform 0.15s cubic-bezier(0.17, 0.89, 0.32, 1.49)',
            }}
          >
            ACTUALLY
          </span>
        )}

        {frame >= 150 && (
          <span
            style={{
              fontSize: 70,
              fontWeight: 800,
              color: '#ffffff',
            }}
          >
            met?
          </span>
        )}
      </div>
    </div>
  )
}
