'use client'

import { ReactNode, useEffect } from 'react'
import { ModalProvider } from './ModalContext'
import { AppCacheProvider } from '@/context/AppCacheContext'
import { NetworkProvider } from '@/context/NetworkContext'
import { GlobalOfflineBanner } from './OfflineNotice'

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Intercept and store beforeinstallprompt event globally
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      ;(window as any).deferredBeforeInstallPrompt = e
      window.dispatchEvent(new Event('unimatch:beforeinstallprompt'))
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // 2. Register PWA service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('[SW] Registered:', reg.scope))
        .catch((err) => console.warn('[SW] Registration failed:', err))
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  return (
    <NetworkProvider>
      <AppCacheProvider>
        <ModalProvider>
          <GlobalOfflineBanner />
          {children}
        </ModalProvider>
      </AppCacheProvider>
    </NetworkProvider>
  )
}

