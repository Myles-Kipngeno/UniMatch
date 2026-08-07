'use client'

import React from 'react'

export default function TopRouteProgress() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', zIndex: 9999, pointerEvents: 'none', overflow: 'hidden', backgroundColor: 'rgba(108, 71, 255, 0.15)' }}>
      <style>{`
        @keyframes topNavProgress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(-20%); }
          100% { transform: translateX(0%); }
        }
      `}</style>
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, #6c47ff 0%, #a855f7 50%, #f472b6 100%)',
          animation: 'topNavProgress 0.8s ease-in-out infinite alternate',
          boxShadow: '0 0 10px rgba(168, 85, 247, 0.6)',
        }}
      />
    </div>
  )
}
