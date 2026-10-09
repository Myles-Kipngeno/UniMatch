'use client'

import React, { useState, useEffect } from 'react'
import { useModal } from './ModalContext'
import './InstallPrompt.css'

const SESSION_DISMISSED_KEY = 'unimatch_pwa_prompt_dismissed'

export default function InstallPrompt() {
  const modal = useModal()
  const [showPrompt, setShowPrompt] = useState(false)
  const [devicePlatform, setDevicePlatform] = useState<'ios' | 'android' | 'desktop'>('android')
  const [isInstalling, setIsInstalling] = useState(false)
  const [domain, setDomain] = useState('uni-match-one.vercel.app')

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.location.host) {
      setDomain(window.location.host)
    }

    // 1. Guard: Never show if already running in standalone/installed mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')

    if (isStandalone) return

    // 2. Clear any legacy permanent localStorage flag so users aren't permanently blocked
    try {
      localStorage.removeItem('unimatch_pwa_prompt_dismissed')
    } catch (_) { }

    // 3. Guard: Never show if user previously dismissed in this active session
    try {
      const alreadyDismissedInSession = sessionStorage.getItem(SESSION_DISMISSED_KEY) === 'true'
      if (alreadyDismissedInSession) return
    } catch (_) { }

    // 4. Identify Device Platform
    const ua = window.navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    const isAndroid = /Android/i.test(ua)

    if (isIOS) {
      setDevicePlatform('ios')
    } else if (isAndroid) {
      setDevicePlatform('android')
    } else {
      setDevicePlatform('desktop')
    }

    // 5. Intercept beforeinstallprompt event whenever browser fires it
    const handleBeforeInstall = (e?: any) => {
      if (e && typeof e.prompt === 'function') {
        ;(window as any).deferredBeforeInstallPrompt = e
      }
    }

    const handleAppInstalled = () => {
      ;(window as any).deferredBeforeInstallPrompt = null
      setShowPrompt(false)
      try {
        sessionStorage.setItem(SESSION_DISMISSED_KEY, 'true')
      } catch (_) {}
      modal.toast('UniMatch installed successfully!', 'success')
    }

    window.addEventListener('unimatch:beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    // 6. Proactively display the install banner for any browser session
    setShowPrompt(true)

    return () => {
      window.removeEventListener('unimatch:beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [modal])

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(SESSION_DISMISSED_KEY, 'true')
    } catch (e) {
      console.warn('Failed to save install prompt dismissal to sessionStorage:', e)
    }
    setShowPrompt(false)
  }

  const handleInstallClick = async () => {
    const deferredEvent = (window as any).deferredBeforeInstallPrompt

    if (deferredEvent && typeof deferredEvent.prompt === 'function') {
      setIsInstalling(true)
      try {
        await deferredEvent.prompt()
        const choiceResult = await deferredEvent.userChoice
        console.log('[PWA] User choice:', choiceResult?.outcome)
        if (choiceResult?.outcome === 'accepted') {
          handleDismiss()
        }
        ;(window as any).deferredBeforeInstallPrompt = null
      } catch (err) {
        console.warn('[PWA] Install prompt error:', err)
        handleDismiss()
      } finally {
        setIsInstalling(false)
      }
      return
    }

    // If native prompt was not triggered by browser (e.g. iOS Safari, or non-secure origin):
    if (devicePlatform === 'ios') {
      modal.alert({
        title: 'Install UniMatch on iOS',
        message: 'Tap the Share button in Safari (bottom bar) and select "Add to Home Screen" to install UniMatch on your device.',
        type: 'info'
      })
    } else if (devicePlatform === 'android') {
      modal.alert({
        title: 'Install UniMatch App',
        message: 'Tap your browser menu (⋮) in the top-right corner and select "Install app" or "Add to Home screen".',
        type: 'info'
      })
    } else {
      modal.alert({
        title: 'Install UniMatch App',
        message: 'Click the Install icon (⊕) in your browser address bar or menu (⋮) to install UniMatch.',
        type: 'info'
      })
    }
    handleDismiss()
  }

  if (!showPrompt) return null

  return (
    <div className="install-prompt-overlay" role="dialog" aria-label="Install UniMatch App">
      <div className="install-prompt-card">
        <img
          src="/Unimatch_icon.png"
          alt="UniMatch"
          className="install-prompt-icon"
          onError={(e) => {
            ; (e.target as HTMLElement).setAttribute('src', '/favicon.svg')
          }}
        />
        <div className="install-prompt-text">
          <h4 className="install-prompt-title">Install UniMatch</h4>
          <p className="install-prompt-subtitle">{domain}</p>
        </div>

        <div className="install-prompt-actions">
          <button
            className="install-btn-text"
            onClick={handleInstallClick}
            disabled={isInstalling}
          >
            {isInstalling ? 'Installing...' : 'Install'}
          </button>
          <button
            className="install-btn-close"
            onClick={handleDismiss}
            aria-label="Close prompt"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}


