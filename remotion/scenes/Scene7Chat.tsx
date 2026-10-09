import React from 'react'
import { PhoneMockup } from '../components/PhoneMockup'
import { THEME } from '../types'

interface SceneProps {
  frame: number
}

export const Scene7Chat: React.FC<SceneProps> = ({ frame }) => {
  // Pacing:
  // 0 to 40: Sent message appears
  // 40 to 110: Typing indicator
  // 110 to 308: Received message and location card appear
  const isTyping = frame >= 40 && frame < 110
  const isReplied = frame >= 110
  const isLocationCard = frame >= 170

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
          border: '1.5px solid rgba(168, 85, 247, 0.5)',
          padding: '10px 24px',
          borderRadius: 40,
          color: '#ffffff',
          fontSize: 20,
          fontWeight: 800,
          boxShadow: '0 8px 30px rgba(124, 58, 237, 0.4)',
        }}
      >
        <span>FROM CAMPUS CHAT TO CAMPUS DATE</span>
      </div>

      <PhoneMockup scale={1.12} rotateY={-5} rotateX={5}>
        {/* Chat UI Screen */}
        <div
          style={{
            padding: '65px 16px 20px',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: '#0d0a1a',
            color: '#ffffff',
          }}
        >
          {/* Chat Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingBottom: 10,
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: '#35153b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                border: '1.5px solid #ec4899',
              }}
            >
              👩‍🎓
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Maya</div>
              <div style={{ fontSize: 10.5, color: '#10b981' }}>● Active on Campus</div>
            </div>
          </div>

          {/* Messages Container */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              paddingTop: 10,
            }}
          >
            {/* Outgoing Message (Icebreaker) */}
            <div style={{ alignSelf: 'flex-end', maxWidth: '82%' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  color: '#ffffff',
                  padding: '10px 14px',
                  borderRadius: '16px 16px 4px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
                }}
              >
                ☕ Coffee between lectures?
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  color: '#94a3b8',
                  textAlign: 'right',
                  marginTop: 2,
                }}
              >
                1:45 PM • <span style={{ color: '#38bdf8' }}>✓✓</span>
              </div>
            </div>

            {/* Typing Indicator */}
            {isTyping && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '8px 14px',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#a78bfa',
                      opacity: (frame + i * 10) % 30 < 15 ? 1 : 0.3,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Incoming Reply */}
            {isReplied && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '82%' }}>
                <div
                  style={{
                    background: '#1f1936',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    padding: '10px 14px',
                    borderRadius: '16px 16px 16px 4px',
                    fontSize: 13,
                    lineHeight: 1.35,
                  }}
                >
                  omg yes 😭 after my 2pm lecture?
                </div>
                <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>
                  1:46 PM
                </div>
              </div>
            )}

            {/* Location Meetup Card */}
            {isLocationCard && (
              <div
                style={{
                  alignSelf: 'center',
                  width: '90%',
                  background: 'rgba(20, 17, 38, 0.95)',
                  border: '1.5px solid #10b981',
                  borderRadius: 14,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.35)',
                }}
              >
                <span style={{ fontSize: 20 }}>📍</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>Student Center</div>
                  <div style={{ fontSize: 10, color: '#34d399' }}>Today · 2:15 PM</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </PhoneMockup>
    </div>
  )
}
