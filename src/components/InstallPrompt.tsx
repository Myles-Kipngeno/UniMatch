'use client'

import React, { useState, useEffect } from 'react'

const STORAGE_KEY = 'unimatch_pwa_prompt_dismissed'

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [platform, setPlatform] = useState<'chromium' | 'ios' | null>(null)
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

    // 2. Guard: Never show if user previously dismissed or installed
    const alreadyDismissed = localStorage.getItem(STORAGE_KEY) === 'true'
    if (alreadyDismissed) return

    // 3. Detect iOS Safari
    const ua = window.navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/i.test(ua)

    if (isIOS) {
      setPlatform('ios')
      setShowPrompt(true)
      return
    }

    // 4. Android / Chromium detection
    const handleBeforeInstall = () => {
      setPlatform('chromium')
      setShowPrompt(true)
    }

    if ((window as any).deferredBeforeInstallPrompt) {
      handleBeforeInstall()
    } else {
      window.addEventListener('unimatch:beforeinstallprompt', handleBeforeInstall)
      window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    }

    return () => {
      window.removeEventListener('unimatch:beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch (e) {
      console.warn('Failed to save install prompt dismissal to localStorage:', e)
    }
    setShowPrompt(false)
  }

  const handleInstallClick = async () => {
    const deferredEvent = (window as any).deferredBeforeInstallPrompt

    if (platform === 'chromium' && deferredEvent) {
      setIsInstalling(true)
      try {
        await deferredEvent.prompt()
        const choiceResult = await deferredEvent.userChoice
        console.log('[PWA] User choice:', choiceResult.outcome)
        ;(window as any).deferredBeforeInstallPrompt = null
      } catch (err) {
        console.warn('[PWA] Install prompt error:', err)
      } finally {
        setIsInstalling(false)
        handleDismiss()
      }
    } else if (platform === 'ios') {
      alert('To install UniMatch: tap the Share icon in Safari, then select "Add to Home Screen".')
      handleDismiss()
    }
  }

  if (!showPrompt || !platform) return null

  return (
    <>
      <style>{`
        @keyframes installSlideDown {
          from {
            transform: translate(-50%, -100%);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
        .install-prompt-overlay {
          position: fixed;
          top: calc(14px + env(safe-area-inset-top, 0px));
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 24px);
          max-width: 440px;
          z-index: 9999;
          animation: installSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .install-prompt-card {
          background: rgba(33, 37, 47, 0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          border-radius: 16px;
          padding: 12px 16px;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .install-prompt-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .install-prompt-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .install-prompt-title {
          font-size: 16px;
          font-weight: 500;
          color: #f1f3f4;
          letter-spacing: -0.2px;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .install-prompt-subtitle {
          font-size: 13.5px;
          color: #9aa0a6;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .install-prompt-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .install-btn-text {
          background: transparent;
          color: #9bb2f4;
          border: none;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          padding: 4px 6px;
          transition: opacity 0.15s ease;
        }
        .install-btn-text:hover {
          opacity: 0.85;
        }
        .install-btn-text:disabled {
          opacity: 0.5;
        }
        .install-btn-close {
          background: transparent;
          color: #80868b;
          border: none;
          font-size: 15px;
          cursor: pointer;
          padding: 2px 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s ease;
        }
        .install-btn-close:hover {
          color: #f1f3f4;
        }
      `}</style>

      <div className="install-prompt-overlay" role="dialog" aria-label="Install UniMatch App">
        <div className="install-prompt-card">
          <img
            src="/Unimatch_icon.png"
            alt="UniMatch"
            className="install-prompt-icon"
            onError={(e) => {
              ;(e.target as HTMLElement).setAttribute('src', '/favicon.svg')
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
    </>
  )
}


