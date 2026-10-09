import React from 'react'
import { THEME } from '../types'

interface SceneProps {
  frame: number
}

export const Scene6MatchMoment: React.FC<SceneProps> = ({ frame }) => {
  // Impact occurs at frame 60
  const impactProgress = Math.min(frame / 60, 1)

  // Avatars fly in from -300px and +300px
  const avatarLeftX = -320 * (1 - impactProgress)
  const avatarRightX = 320 * (1 - impactProgress)

  // Shockwave expansion after frame 60
  const isPostImpact = frame >= 60
  const shockwaveScale = isPostImpact ? (frame - 60) * 0.12 : 0
  const shockwaveOpacity = isPostImpact ? Math.max(0, 1 - (frame - 60) / 70) : 0

  // Match title scale with overshoot
  const titleScale = isPostImpact ? (frame < 80 ? 1.3 : 1.0) : 0

  // Icebreaker chip floats up at frame 120
  const showIcebreaker = frame >= 120
  const icebreakerY = showIcebreaker ? Math.max(0, 40 * (1 - (frame - 120) / 20)) : 40

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle at center, #1f123b 0%, #0b0914 90%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Shockwave Energy Ring */}
      {isPostImpact && (
        <div
          style={{
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: '50%',
            border: '4px solid #ec4899',
            boxShadow: '0 0 50px #7c3aed',
            transform: `scale(${shockwaveScale})`,
            opacity: shockwaveOpacity,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Center Avatar Collision */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          marginBottom: 40,
        }}
      >
        {/* Left Avatar (Alex) */}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: '50%',
            border: '4px solid #7c3aed',
            boxShadow: '0 0 30px rgba(124, 58, 237, 0.8)',
            background: '#241a4a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 60,
            transform: `translate(${avatarLeftX}px, 0)`,
            zIndex: 10,
          }}
        >
          👨‍🎓
        </div>

        {/* Center Heart Emblem on Impact */}
        {isPostImpact && (
          <div
            style={{
              position: 'absolute',
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: '#ec4899',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              boxShadow: '0 0 24px #ec4899',
              zIndex: 30,
              transform: 'scale(1.1)',
            }}
          >
            ♥
          </div>
        )}

        {/* Right Avatar (Maya) */}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: '50%',
            border: '4px solid #ec4899',
            boxShadow: '0 0 30px rgba(236, 72, 153, 0.8)',
            background: '#35153b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 60,
            transform: `translate(${avatarRightX}px, 0)`,
            zIndex: 10,
          }}
        >
          👩‍🎓
        </div>
      </div>

      {/* Kinetic "IT'S A MATCH!" */}
      {isPostImpact && (
        <div
          style={{
            textAlign: 'center',
            transform: `scale(${titleScale})`,
            transition: 'transform 0.2s cubic-bezier(0.17, 0.89, 0.32, 1.49)',
            marginBottom: 30,
          }}
        >
          <h1
            style={{
              fontSize: 72,
              fontWeight: 900,
              margin: 0,
              letterSpacing: 2,
              background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #7c3aed 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 40px rgba(236, 72, 153, 0.6)',
            }}
          >
            IT&apos;S A MATCH!
          </h1>
          <p style={{ fontSize: 20, color: '#e2e8f0', margin: '8px 0 0', fontWeight: 600 }}>
            You and Maya liked each other
          </p>
        </div>
      )}

      {/* Icebreaker Opener Chip */}
      {showIcebreaker && (
        <div
          style={{
            background: 'rgba(20, 17, 38, 0.9)',
            border: '2px solid #7c3aed',
            borderRadius: 30,
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 10px 40px rgba(124, 58, 237, 0.6)',
            transform: `translate(0, ${icebreakerY}px)`,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 24 }}>☕</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#ffffff' }}>
            Coffee between lectures?
          </span>
          <span style={{ fontSize: 18, color: '#a78bfa' }}>➔</span>
        </div>
      )}
    </div>
  )
}
