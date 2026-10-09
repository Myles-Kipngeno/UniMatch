import React from 'react'
import { PhoneMockup } from '../components/PhoneMockup'
import { THEME } from '../types'

interface SceneProps {
  frame: number
}

export const Scene3Onboarding: React.FC<SceneProps> = ({ frame }) => {
  // Pacing: frame 0 to 410
  // Avatar drops in around frame 60
  const avatarFilled = frame >= 80

  // 6 slots fill sequentially on the beat (approx every 25 frames)
  const slotCount = Math.min(Math.max(0, Math.floor((frame - 110) / 30)), 6)

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
      {/* 60 Seconds Timer Pill */}
      <div
        style={{
          position: 'absolute',
          top: 70,
          zIndex: 50,
          background: 'rgba(124, 58, 237, 0.2)',
          border: '1.5px solid #7c3aed',
          padding: '10px 24px',
          borderRadius: 40,
          color: '#ffffff',
          fontSize: 20,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 0 30px rgba(124, 58, 237, 0.4)',
        }}
      >
        <span>⚡</span>
        <span>SETUP: 60 SECONDS</span>
      </div>

      <PhoneMockup scale={1.12} rotateY={-8} rotateX={8}>
        {/* Step 4 Profile Screen */}
        <div
          style={{
            padding: '60px 18px 20px',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            background: 'linear-gradient(180deg, #130f26 0%, #0b0914 100%)',
            color: '#ffffff',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: 20, margin: '0 0 4px', fontWeight: 800 }}>Profile Photos & Gallery</h3>
            <p style={{ fontSize: 12, color: THEME.gray, margin: 0 }}>Showcase your best moments</p>
          </div>

          {/* Primary Circular Avatar with Glowing Ring and Pencil Badge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 105,
                height: 105,
                borderRadius: '50%',
                border: '3px solid #7c3aed',
                boxShadow: '0 0 24px rgba(124, 58, 237, 0.65)',
                background: avatarFilled ? '#241a4a' : 'rgba(255, 255, 255, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {avatarFilled ? (
                <div style={{ fontSize: 44 }}>📸</div>
              ) : (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', textAlign: 'center' }}>
                  📷<br />ADD PHOTO
                </div>
              )}

              {/* Edit Pencil Button */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: '#18152e',
                  border: '1.5px solid #7c3aed',
                  color: '#ffffff',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✎
              </div>
            </div>

            <span style={{ fontSize: 15, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              ALEX
            </span>
            <span style={{ fontSize: 10.5, color: '#a78bfa' }}>
              Primary Avatar • Appears First on Campus Cards
            </span>
          </div>

          {/* Showcase Photos Card */}
          <div
            style={{
              background: 'rgba(20, 17, 38, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 18,
              padding: '14px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Showcase Photos</h4>
                <p style={{ margin: 0, fontSize: 10, color: THEME.gray }}>Add a few photos</p>
              </div>
              <button
                style={{
                  background: '#7c3aed',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 20,
                  padding: '4px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                + Add Photos
              </button>
            </div>

            {/* 6-Slot Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((num) => {
                const isFilled = slotCount >= num
                return (
                  <div
                    key={num}
                    style={{
                      aspectRatio: '1 / 1.05',
                      borderRadius: 10,
                      background: isFilled ? '#251c4a' : 'rgba(255, 255, 255, 0.03)',
                      border: isFilled ? '1px solid rgba(124, 58, 237, 0.6)' : '1px dashed rgba(255, 255, 255, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      fontSize: 11,
                      transform: isFilled ? 'scale(1.02)' : 'scale(1)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {isFilled ? (
                      <>
                        <span style={{ fontSize: 24 }}>✨</span>
                        {num === 1 && (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 4,
                              left: 4,
                              background: '#7c3aed',
                              color: '#ffffff',
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 6,
                            }}
                          >
                            Main
                          </span>
                        )}
                        <span
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            fontSize: 9,
                            color: '#94a3b8',
                          }}
                        >
                          ✕
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ color: '#64748b' }}>📷</span>
                        <span style={{ fontSize: 9, color: '#94a3b8' }}>Add Photo</span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Single Important Tip */}
            <div
              style={{
                background: 'rgba(124, 58, 237, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                borderRadius: 8,
                padding: '6px 8px',
                fontSize: 10,
                color: '#c4b5fd',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>💡</span>
              <span><strong>Tip:</strong> Use clear, high-quality photos for best results.</span>
            </div>
          </div>
        </div>
      </PhoneMockup>
    </div>
  )
}
