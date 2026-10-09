import React from 'react'
import { PhoneMockup } from '../components/PhoneMockup'
import { THEME } from '../types'

interface SceneProps {
  frame: number
}

export const Scene4CampusPulse: React.FC<SceneProps> = ({ frame }) => {
  // Radar rotation angle
  const radarAngle = (frame * 3) % 360

  // Check in tap at frame 180
  const isCheckedIn = frame >= 180
  const libraryCount = isCheckedIn ? 13 : 12

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
          background: 'rgba(124, 58, 237, 0.25)',
          border: '1px solid rgba(168, 85, 247, 0.5)',
          padding: '10px 24px',
          borderRadius: 40,
          color: '#ffffff',
          fontSize: 20,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 8px 30px rgba(124, 58, 237, 0.4)',
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 10px #10b981',
          }}
        />
        <span>CAMPUS PULSE • LIVE RADAR</span>
      </div>

      <PhoneMockup scale={1.12} rotateX={12} rotateY={-5}>
        {/* Pulse Radar Screen */}
        <div
          style={{
            padding: '70px 16px 20px',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            background: '#0d0a1a',
            color: '#ffffff',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 20, margin: '0 0 2px', fontWeight: 800 }}>Campus Pulse</h3>
              <p style={{ fontSize: 12, color: THEME.gray, margin: 0 }}>Active students nearby</p>
            </div>
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                borderRadius: 20,
                padding: '4px 10px',
                fontSize: 11,
                color: '#34d399',
                fontWeight: 700,
              }}
            >
              ● 35 ONLINE
            </div>
          </div>

          {/* Interactive Radar Map View */}
          <div
            style={{
              flex: 1,
              borderRadius: 24,
              background: 'radial-gradient(circle at center, #18142f 0%, #0c0918 80%)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Concentric Radar Rings */}
            {[80, 160, 240, 320].map((size) => (
              <div
                key={size}
                style={{
                  position: 'absolute',
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  border: '1px dashed rgba(124, 58, 237, 0.25)',
                }}
              />
            ))}

            {/* Rotating Radar Sweep Line */}
            <div
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                background: `conic-gradient(from ${radarAngle}deg at 50% 50%, rgba(124, 58, 237, 0.35) 0deg, transparent 60deg)`,
                pointerEvents: 'none',
              }}
            />

            {/* Hotspot 1: Library */}
            <div
              style={{
                position: 'absolute',
                top: '25%',
                left: '28%',
                background: 'rgba(20, 17, 38, 0.9)',
                border: '1.5px solid #7c3aed',
                borderRadius: 12,
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 0 20px rgba(124, 58, 237, 0.6)',
              }}
            >
              <span>📚</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800 }}>Library</div>
                <div style={{ fontSize: 9.5, color: '#a78bfa' }}>{libraryCount} students</div>
              </div>
            </div>

            {/* Hotspot 2: Student Center */}
            <div
              style={{
                position: 'absolute',
                top: '55%',
                right: '18%',
                background: 'rgba(20, 17, 38, 0.9)',
                border: '1.5px solid #ec4899',
                borderRadius: 12,
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 0 20px rgba(236, 72, 153, 0.5)',
              }}
            >
              <span>☕</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800 }}>Student Center</div>
                <div style={{ fontSize: 9.5, color: '#f472b6' }}>8 students</div>
              </div>
            </div>

            {/* Hotspot 3: The Mess */}
            <div
              style={{
                position: 'absolute',
                bottom: '18%',
                left: '32%',
                background: 'rgba(20, 17, 38, 0.9)',
                border: '1.5px solid #3b82f6',
                borderRadius: 12,
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
              }}
            >
              <span>🍔</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800 }}>The Mess</div>
                <div style={{ fontSize: 9.5, color: '#93c5fd' }}>15 students</div>
              </div>
            </div>
          </div>

          {/* Quick Check-In CTA Button */}
          <button
            style={{
              background: isCheckedIn ? '#059669' : 'linear-gradient(135deg, #7c3aed, #ec4899)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 16,
              padding: '14px',
              fontSize: 14,
              fontWeight: 800,
              boxShadow: '0 4px 20px rgba(124, 58, 237, 0.4)',
            }}
          >
            {isCheckedIn ? '✓ CHECKED IN AT LIBRARY' : '📍 CHECK IN ON CAMPUS'}
          </button>
        </div>
      </PhoneMockup>
    </div>
  )
}
