'use client'

import React from 'react'

export function SkeletonBlock({
  width = '100%',
  height = '16px',
  borderRadius = '8px',
  className = '',
  style = {},
}: {
  width?: string
  height?: string
  borderRadius?: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`skeleton-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: '#1e1c2a',
        background: 'linear-gradient(90deg, #1e1c2a 0%, #2a283e 50%, #1e1c2a 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonPulse 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

export function DashboardSkeleton() {
  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes skeletonPulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <SkeletonBlock width="140px" height="24px" borderRadius="6px" style={{ marginBottom: '8px' }} />
          <SkeletonBlock width="200px" height="14px" borderRadius="4px" />
        </div>
        <SkeletonBlock width="44px" height="44px" borderRadius="50%" />
      </div>

      {/* Profile completion bar */}
      <SkeletonBlock width="100%" height="60px" borderRadius="16px" style={{ marginBottom: '20px' }} />

      {/* Quick Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} width="100%" height="70px" borderRadius="14px" />
        ))}
      </div>

      {/* Activity Feed Section */}
      <SkeletonBlock width="160px" height="20px" borderRadius="6px" style={{ marginBottom: '12px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {[1, 2, 3].map((i) => (
          <SkeletonBlock key={i} width="100%" height="56px" borderRadius="12px" />
        ))}
      </div>

      {/* Campus Spots Section */}
      <SkeletonBlock width="180px" height="20px" borderRadius="6px" style={{ marginBottom: '12px' }} />
      <div style={{ display: 'flex', gap: '10px', overflowX: 'hidden' }}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} width="110px" height="90px" borderRadius="14px" style={{ flexShrink: 0 }} />
        ))}
      </div>
    </div>
  )
}

export function DiscoverSkeleton() {
  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto', width: '100%', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {/* Top Filter Bar Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <SkeletonBlock width="120px" height="22px" borderRadius="6px" />
        <SkeletonBlock width="36px" height="36px" borderRadius="10px" />
      </div>

      {/* Main Card Frame */}
      <div style={{ flex: 1, borderRadius: '24px', backgroundColor: '#13121d', border: '1px solid #262438', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative', overflow: 'hidden' }}>
        <SkeletonBlock width="100%" height="100%" borderRadius="20px" style={{ position: 'absolute', top: 0, left: 0, opacity: 0.15 }} />
        
        <div style={{ position: 'relative', zIndex: 2 }}>
          <SkeletonBlock width="180px" height="28px" borderRadius="8px" style={{ marginBottom: '10px' }} />
          <SkeletonBlock width="240px" height="16px" borderRadius="6px" style={{ marginBottom: '14px' }} />
          <SkeletonBlock width="100%" height="40px" borderRadius="8px" style={{ marginBottom: '16px' }} />
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <SkeletonBlock width="70px" height="26px" borderRadius="20px" />
            <SkeletonBlock width="90px" height="26px" borderRadius="20px" />
            <SkeletonBlock width="80px" height="26px" borderRadius="20px" />
          </div>
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '16px' }}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} width="56px" height="56px" borderRadius="50%" />
        ))}
      </div>
    </div>
  )
}

export function MatchesSkeleton() {
  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <SkeletonBlock width="140px" height="24px" borderRadius="6px" style={{ marginBottom: '16px' }} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {[1, 2, 3].map((i) => (
          <SkeletonBlock key={i} width="90px" height="36px" borderRadius="20px" />
        ))}
      </div>

      {/* Match Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', borderRadius: '16px', backgroundColor: '#141320', border: '1px solid #232135' }}>
            <SkeletonBlock width="52px" height="52px" borderRadius="50%" />
            <div style={{ flex: 1 }}>
              <SkeletonBlock width="130px" height="18px" borderRadius="4px" style={{ marginBottom: '6px' }} />
              <SkeletonBlock width="190px" height="14px" borderRadius="4px" />
            </div>
            <SkeletonBlock width="40px" height="12px" borderRadius="4px" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChatSkeleton() {
  return (
    <div style={{ padding: '16px', maxWidth: '700px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <SkeletonBlock width="100px" height="24px" borderRadius="6px" />
        <SkeletonBlock width="32px" height="32px" borderRadius="50%" />
      </div>

      {/* Conversations List Skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', borderRadius: '16px', backgroundColor: '#141320' }}>
            <SkeletonBlock width="48px" height="48px" borderRadius="50%" />
            <div style={{ flex: 1 }}>
              <SkeletonBlock width="120px" height="16px" borderRadius="4px" style={{ marginBottom: '6px' }} />
              <SkeletonBlock width="180px" height="13px" borderRadius="4px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChatMessageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
      <SkeletonBlock width="140px" height="36px" borderRadius="18px" style={{ alignSelf: 'flex-start' }} />
      <SkeletonBlock width="200px" height="44px" borderRadius="18px" style={{ alignSelf: 'flex-end' }} />
      <SkeletonBlock width="160px" height="36px" borderRadius="18px" style={{ alignSelf: 'flex-start' }} />
      <SkeletonBlock width="120px" height="36px" borderRadius="18px" style={{ alignSelf: 'flex-end' }} />
    </div>
  )
}

export function NotificationsSkeleton() {
  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <SkeletonBlock width="150px" height="24px" borderRadius="6px" style={{ marginBottom: '20px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', borderRadius: '16px', backgroundColor: '#141320', border: '1px solid #232135' }}>
            <SkeletonBlock width="42px" height="42px" borderRadius="50%" />
            <div style={{ flex: 1 }}>
              <SkeletonBlock width="160px" height="16px" borderRadius="4px" style={{ marginBottom: '6px' }} />
              <SkeletonBlock width="210px" height="13px" borderRadius="4px" />
            </div>
            <SkeletonBlock width="36px" height="12px" borderRadius="4px" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div style={{ padding: '16px', maxWidth: '540px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Cover/Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0 24px 0' }}>
        <SkeletonBlock width="100px" height="100px" borderRadius="50%" style={{ marginBottom: '14px' }} />
        <SkeletonBlock width="160px" height="24px" borderRadius="6px" style={{ marginBottom: '8px' }} />
        <SkeletonBlock width="220px" height="14px" borderRadius="4px" />
      </div>

      {/* Bio section */}
      <div style={{ padding: '16px', borderRadius: '18px', backgroundColor: '#141320', marginBottom: '20px' }}>
        <SkeletonBlock width="60px" height="16px" borderRadius="4px" style={{ marginBottom: '10px' }} />
        <SkeletonBlock width="100%" height="40px" borderRadius="6px" />
      </div>

      {/* Interests */}
      <div style={{ padding: '16px', borderRadius: '18px', backgroundColor: '#141320', marginBottom: '20px' }}>
        <SkeletonBlock width="80px" height="16px" borderRadius="4px" style={{ marginBottom: '12px' }} />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} width="70px" height="28px" borderRadius="20px" />
          ))}
        </div>
      </div>

      {/* Photo Gallery Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonBlock key={i} width="100%" height="110px" borderRadius="12px" />
        ))}
      </div>
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    <div style={{ padding: '16px', maxWidth: '540px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <SkeletonBlock width="120px" height="24px" borderRadius="6px" style={{ marginBottom: '20px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonBlock key={i} width="100%" height="52px" borderRadius="14px" />
        ))}
      </div>
    </div>
  )
}
