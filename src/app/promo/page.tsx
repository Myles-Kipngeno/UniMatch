'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { UniMatchPromo } from '@/../remotion/UniMatchPromo'
import { VIDEO_CONFIG, SCENE_RANGES, THEME } from '@/../remotion/types'

const SCENES_LIST = [
  { id: 1, name: '1. Hook', from: SCENE_RANGES.scene1Hook.from, vo: '"Okay, real talk… how many people on campus have you actually met?"' },
  { id: 2, name: '2. Verification', from: SCENE_RANGES.scene2Verification.from, vo: '"This is UniMatch. Everyone here is a verified student: school email or student ID. [beat] No randoms. No catfish."' },
  { id: 3, name: '3. Step 4 Profile', from: SCENE_RANGES.scene3Onboarding.from, vo: '"Setup takes, like, sixty seconds. Drop your main pic, fill your gallery… [beat] and you\'re in."' },
  { id: 4, name: '4. Campus Pulse', from: SCENE_RANGES.scene4CampusPulse.from, vo: '"Then there\'s Campus Pulse. See who\'s live at the library, the Student Center, the Mess… right now."' },
  { id: 5, name: '5. Discovery Deck', from: SCENE_RANGES.scene5DiscoveryDeck.from, vo: '"Swipe through people who actually get you. Same interests, same campus, same late-night library grind."' },
  { id: 6, name: '6. Match Moment', from: SCENE_RANGES.scene6MatchMoment.from, vo: '"And when it clicks? [beat 0.5s] It\'s a match. We\'ll even give you the opener."' },
  { id: 7, name: '7. Real-Time Chat', from: SCENE_RANGES.scene7Chat.from, vo: '"\'Coffee between lectures?\' [beat] Say less."' },
  { id: 8, name: '8. Outro & CTA', from: SCENE_RANGES.scene8Outro.from, vo: '"UniMatch. Your campus is waiting. [beat] Link in bio."' },
]

export default function PromoVideoPlayerPage() {
  const [frame, setFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const lastTimeRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // High-performance real-time playback timer (never freezes or misses frames)
  useEffect(() => {
    if (!isPlaying) return

    let lastTimestamp = performance.now()
    const timerId = setInterval(() => {
      const now = performance.now()
      const deltaSec = (now - lastTimestamp) / 1000
      lastTimestamp = now

      const deltaFrames = Math.max(1, Math.round(deltaSec * VIDEO_CONFIG.fps))
      setFrame((prev) => {
        const next = prev + deltaFrames
        return next >= VIDEO_CONFIG.totalFrames ? 0 : next
      })
    }, 33)

    return () => clearInterval(timerId)
  }, [isPlaying])

  const currentTimeInSeconds = (frame / VIDEO_CONFIG.fps).toFixed(1)
  const currentScene = SCENES_LIST.slice().reverse().find((s) => frame >= s.from) || SCENES_LIST[0]

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#07050d',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top Header Bar */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          background: 'rgba(20, 17, 38, 0.75)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link
            href="/"
            style={{
              color: '#a78bfa',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ← Back to App
          </Link>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
          <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: 0.5 }}>
            UniMatch • 45s Promo Video Studio (60 FPS)
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              background: '#7c3aed',
              color: '#ffffff',
              padding: '3px 10px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            140 BPM Grid
          </span>
          <span
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              border: '1px solid #10b981',
              padding: '3px 10px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            1080 × 1920 (9:16)
          </span>
        </div>
      </header>

      {/* Main Theater Layout */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 20px',
          boxSizing: 'border-box',
          gap: 16,
        }}
      >
        {/* Phone Viewport Container (Scaled to Fit Comfortably) */}
        <div
          style={{
            height: 'min(70dvh, 620px)',
            aspectRatio: '9 / 16',
            borderRadius: 36,
            overflow: 'hidden',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.9), 0 0 50px rgba(124, 58, 237, 0.35)',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            background: THEME.bg,
            position: 'relative',
          }}
        >
          <UniMatchPromo currentFrame={frame} />
        </div>

        {/* Live Voiceover Teleprompter Pill */}
        <div
          style={{
            maxWidth: 620,
            width: '100%',
            background: 'rgba(20, 17, 38, 0.85)',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            borderRadius: 16,
            padding: '10px 18px',
            textAlign: 'center',
            fontSize: 13.5,
            color: '#e2e8f0',
            lineHeight: 1.4,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          <span style={{ color: '#a78bfa', fontWeight: 700, marginRight: 8 }}>
            🎙️ VO ({currentScene.name}):
          </span>
          <span style={{ fontStyle: 'italic' }}>{currentScene.vo}</span>
        </div>

        {/* Playback Controls & Timeline Scrubber */}
        <div
          style={{
            maxWidth: 680,
            width: '100%',
            background: 'rgba(20, 17, 38, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 20,
            padding: '14px 20px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Timeline Scrubber Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', minWidth: 44 }}>
              {currentTimeInSeconds}s
            </span>
            <input
              type="range"
              min={0}
              max={VIDEO_CONFIG.totalFrames - 1}
              value={frame}
              onChange={(e) => {
                setIsPlaying(false)
                setFrame(Number(e.target.value))
              }}
              style={{
                flex: 1,
                accentColor: '#7c3aed',
                cursor: 'pointer',
                height: 6,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', minWidth: 44 }}>
              45.0s
            </span>
          </div>

          {/* Buttons & Scene Quick Selectors */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            {/* Play/Pause & Step Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  background: isPlaying ? '#4b5563' : '#7c3aed',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: isPlaying ? 'none' : '0 0 16px rgba(124, 58, 237, 0.6)',
                }}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>

              <button
                type="button"
                onClick={() => setFrame(0)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 12,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ↺ Restart
              </button>

              <button
                type="button"
                onClick={() => setFrame((f) => Math.max(0, f - Math.round(VIDEO_CONFIG.framesPerBar)))}
                title="Back 1 bar"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 12,
                  padding: '8px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ⏪
              </button>

              <button
                type="button"
                onClick={() => setFrame((f) => Math.min(VIDEO_CONFIG.totalFrames - 1, f + Math.round(VIDEO_CONFIG.framesPerBar)))}
                title="Forward 1 bar"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 12,
                  padding: '8px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ⏩
              </button>
            </div>

            {/* Frame readout */}
            <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'monospace' }}>
              Frame: <strong style={{ color: '#ffffff' }}>{frame}</strong> / {VIDEO_CONFIG.totalFrames}
            </div>
          </div>

          {/* Quick Scene Jump Buttons */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              paddingTop: 4,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {SCENES_LIST.map((s) => {
              const isActive = currentScene.id === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setFrame(s.from)
                    setIsPlaying(true)
                  }}
                  style={{
                    background: isActive ? '#7c3aed' : 'rgba(255, 255, 255, 0.04)',
                    color: isActive ? '#ffffff' : '#cbd5e1',
                    border: isActive ? '1px solid #a78bfa' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 8,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
