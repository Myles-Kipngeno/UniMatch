'use client'

import { ReactNode } from 'react'
import { ModalProvider } from './ModalContext'
import { AppCacheProvider } from '@/context/AppCacheContext'
import { NetworkProvider } from '@/context/NetworkContext'
import { GlobalOfflineBanner } from './OfflineNotice'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <NetworkProvider>
      <AppCacheProvider>
        <ModalProvider>
          {/* Keyframe for banner slide-in animation */}
          <style>{`
            @keyframes slideDownBanner {
              from { transform: translateY(-100%); opacity: 0; }
              to   { transform: translateY(0);     opacity: 1; }
            }
          `}</style>
          <GlobalOfflineBanner />
          {children}
        </ModalProvider>
      </AppCacheProvider>
    </NetworkProvider>
  )
}
