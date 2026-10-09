import React from 'react'
import { PhoneMockup } from '../components/PhoneMockup'
import { THEME } from '../types'

interface SceneProps {
  frame: number
}

export const Scene5DiscoveryDeck: React.FC<SceneProps> = ({ frame }) => {
  // Card swipe simulation:
  // 0 to 120: Card 1 tilts and swipes right (+250px)
  // 120 to 410: Card 2 active, interests lighting up
  const isSwipingRight = frame > 60 && frame < 130
  const swipeX = isSwipingRight ? (frame - 60) * 6 : frame >= 130 ? 500 : 0
  const swipeRot = isSwipingRight ? (frame - 60) * 0.25 : 0
  const cardOpacity = isSwipingRight ? Math.max(0, 1 - (frame - 60) / 60) : 1

  const tagLightUp = frame >= 180

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
      {/* Top Banner Tag */}
      <div
        style={{
          position: 'absolute',
          top: 70,
          zIndex: 50,
          background: 'rgba(236, 72, 153, 0.25)',
          border: '1px solid rgba(236, 72, 153, 0.5)',
          padding: '10px 24px',
          borderRadius: 40,
          color: '#ffffff',
          fontSize: 20,
          fontWeight: 800,
          boxShadow: '0 8px 30px rgba(236, 72, 153, 0.4)',
        }}
      >
        <span>SAME CAMPUS • SAME VIBE</span>
      </div>

      <PhoneMockup scale={1.12} rotateY={6} rotateX={6}>
        {/* Discovery Screen */}
        <div
          style={{
            padding: '70px 14px 20px',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: '#0d0b1a',
            color: '#ffffff',
            position: 'relative',
          }}
        >
          {/* Main Card Stack */}
          <div
            style={{
              flex: 1,
              borderRadius: 24,
              overflow: 'hidden',
              background: 'linear-gradient(180deg, #1c1533 0%, #120e24 100%)',
              border: '1.5px solid rgba(124, 58, 237, 0.4)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: 20,
              boxSizing: 'border-box',
              transform: `translate(${swipeX}px, 0) rotate(${swipeRot}deg)`,
              opacity: cardOpacity,
              boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            }}
          >
            {/* Mock Profile Image Avatar */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at 50% 35%, #31215b 0%, #150f28 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 90,
              }}
            >
              👩‍🎓
            </div>

            {/* Profile Info Overlay */}
            <div style={{ zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Maya, 21</h3>
                <span
                  style={{
                    background: '#10b981',
                    borderRadius: '50%',
                    width: 18,
                    height: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                  }}
                >
                  ✓
                </span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#c4b5fd' }}>
                Computer Science • Year 3 • Strathmore
              </p>

              {/* Shared Interest Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { icon: '🎵', label: 'Music' },
                  { icon: '⚽', label: 'Football' },
                  { icon: '📚', label: 'Library grind' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: tagLightUp ? 'rgba(236, 72, 153, 0.35)' : 'rgba(255, 255, 255, 0.1)',
                      border: tagLightUp ? '1px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 20,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: tagLightUp ? '#fbcfe8' : '#cbd5e1',
                      boxShadow: tagLightUp ? '0 0 12px rgba(236, 72, 153, 0.5)' : 'none',
                    }}
                  >
                    {item.icon} {item.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Swipe Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, padding: '6px 0' }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: '#1e1834',
                border: '1.5px solid rgba(255, 255, 255, 0.15)',
                color: '#ef4444',
                fontSize: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </div>
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                color: '#ffffff',
                fontSize: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 24px rgba(124, 58, 237, 0.6)',
              }}
            >
              ♥
            </div>
          </div>
        </div>
      </PhoneMockup>
    </div>
  )
}
