import React from 'react'

interface PhoneMockupProps {
  children: React.ReactNode
  rotateX?: number
  rotateY?: number
  rotateZ?: number
  scale?: number
  translateY?: number
  translateX?: number
  translateZ?: number
  glintProgress?: number // 0 to 1
  rimLightColor?: string
}

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  children,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  scale = 1,
  translateY = 0,
  translateX = 0,
  translateZ = 0,
  glintProgress = 0,
  rimLightColor = 'rgba(124, 58, 237, 0.45)',
}) => {
  return (
    <div
      style={{
        perspective: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}
    >
      <div
        style={{
          width: 324,
          height: 590,
          borderRadius: 42,
          background: '#15131e',
          padding: 8,
          boxSizing: 'border-box',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: `translate3d(${translateX}px, ${translateY}px, ${translateZ}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${scale})`,
          boxShadow: `
            0 20px 60px rgba(0, 0, 0, 0.8),
            0 0 50px ${rimLightColor},
            inset 0 0 3px rgba(255, 255, 255, 0.25)
          `,
          border: '2.5px solid #2d2b38',
        }}
      >
        {/* Titanium Chamfer Edge */}
        <div
          style={{
            position: 'absolute',
            inset: 2,
            borderRadius: 38,
            border: '1.2px solid rgba(255, 255, 255, 0.12)',
            pointerEvents: 'none',
          }}
        />

        {/* Screen Display Container */}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 34,
            overflow: 'hidden',
            background: '#0b0914',
            position: 'relative',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Dynamic Island */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 90,
              height: 22,
              borderRadius: 16,
              background: '#000000',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: 8,
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
            }}
          >
            {/* Camera sensor dot */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#0a0d18',
                border: '1px solid #1c2237',
              }}
            />
          </div>

          {/* Screen Content */}
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {children}
          </div>

          {/* Specular Glass Glint Sweep */}
          {glintProgress > 0 && glintProgress < 1 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: `linear-gradient(
                  115deg,
                  transparent 0%,
                  rgba(255, 255, 255, 0.0) ${glintProgress * 100 - 20}%,
                  rgba(255, 255, 255, 0.25) ${glintProgress * 100}%,
                  rgba(255, 255, 255, 0.0) ${glintProgress * 100 + 20}%,
                  transparent 100%
                )`,
                zIndex: 90,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
