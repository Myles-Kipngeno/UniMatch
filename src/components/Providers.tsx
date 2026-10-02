'use client'

import { ReactNode, useEffect } from 'react'
import { ModalProvider } from './ModalContext'
import { AppCacheProvider } from '@/context/AppCacheContext'
import { NetworkProvider } from '@/context/NetworkContext'
import { GlobalOfflineBanner } from './OfflineNotice'
import InstallPrompt from './InstallPrompt'

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Intercept and store beforeinstallprompt event globally
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
        ; (window as any).deferredBeforeInstallPrompt = e
      window.dispatchEvent(new Event('unimatch:beforeinstallprompt'))
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // 2. Register PWA service worker — production only.
    // In development the SW serves stale cached pages/JS (dev chunk names never
    // change and pages compile slower than the SW's 5s timeout), which causes
    // hydration mismatches. So in dev, remove any registered SW and its caches.
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => console.log('[SW] Registered:', reg.scope))
          .catch((err) => console.warn('[SW] Registration failed:', err))
      } else {
        navigator.serviceWorker.getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister())))
          .then((results) => {
            if (results.length > 0) console.log('[SW] Unregistered in development')
          })
          .catch(() => { })

        if ('caches' in window) {
          caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k.startsWith('unimatch-') || k.startsWith('workbox-')).map((k) => caches.delete(k))))
            .catch(() => { })
        }
      }
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
          <InstallPrompt />
        </ModalProvider>
      </AppCacheProvider>
    </NetworkProvider>
  )
}

