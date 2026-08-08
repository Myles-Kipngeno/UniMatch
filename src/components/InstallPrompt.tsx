'use client'

import React, { useState, useEffect } from 'react'

const STORAGE_KEY = 'unimatch_pwa_prompt_dismissed'

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [platform, setPlatform] = useState<'chromium' | 'ios' | null>(null)
  const [isInstalling, setIsInstalling] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

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
    const isIOSWebkit = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS/i.test(ua)

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
      // Dismiss iOS instruction card once acknowledged
      handleDismiss()
    }
  }

  if (!showPrompt || !platform) return null

  return (
    <>
      <style>{`
        @keyframes installSlideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .install-prompt-overlay {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 32px);
          max-width: 480px;
          z-index: 9999;
          animation: installSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .install-prompt-card {
          background: rgba(19, 14, 34, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(225, 29, 72, 0.2);
          border-radius: 20px;
          padding: 18px 20px;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .install-prompt-header {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .install-prompt-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          object-fit: cover;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .install-prompt-titles {
          flex: 1;
          min-width: 0;
        }
        .install-prompt-title {
          font-size: 16px;
          font-weight: 800;
          margin: 0 0 2px 0;
          color: #ffffff;
          letter-spacing: -0.2px;
        }
        .install-prompt-subtitle {
          font-size: 12.5px;
          color: #b0a4cb;
          margin: 0;
          line-height: 1.35;
        }
        .install-ios-steps {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 12.5px;
          color: #d1c7e6;
          display: flex;
          align-items: center;
          gap: 8px;
          line-height: 1.4;
        }
        .install-ios-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          border-radius: 6px;
          flex-shrink: 0;
        }
        .install-prompt-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .install-btn-primary {
          flex: 1;
          background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
          color: #ffffff;
          border: none;
          padding: 10px 16px;
          border-radius: 12px;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 4px 14px rgba(225, 29, 72, 0.35);
        }
        .install-btn-primary:active {
          transform: scale(0.97);
        }
        .install-btn-dismiss {
          background: rgba(255, 255, 255, 0.08);
          color: #9d91b8;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .install-btn-dismiss:hover {
          background: rgba(255, 255, 255, 0.14);
          color: #ffffff;
        }
        @media (max-width: 480px) {
          .install-prompt-overlay {
            bottom: calc(72px + env(safe-area-inset-bottom, 0px));
            width: calc(100% - 24px);
          }
        }
      `}</style>

      <div className="install-prompt-overlay" role="dialog" aria-label="Install UniMatch App">
        <div className="install-prompt-card">
          <div className="install-prompt-header">
            <img
              src="/Unimatch_icon.png"
              alt="UniMatch Icon"
              className="install-prompt-icon"
              onError={(e) => {
                // Fallback to favicon if image fails
                ;(e.target as HTMLElement).setAttribute('src', '/favicon.svg')
              }}
            />
            <div className="install-prompt-titles">
              <h3 className="install-prompt-title">Install UniMatch</h3>
              <p className="install-prompt-subtitle">
                Get faster access and a full-screen experience
              </p>
            </div>
          </div>

          {platform === 'ios' && (
            <div className="install-ios-steps">
              <span className="install-ios-icon">
                {/* iOS Share SVG Icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </span>
              <span>
                Tap the <strong>Share</strong> icon below, then select <strong>&quot;Add to Home Screen&quot;</strong>.
              </span>
            </div>
          )}

          <div className="install-prompt-actions">
            {platform === 'chromium' && (
              <button
                className="install-btn-primary"
                onClick={handleInstallClick}
                disabled={isInstalling}
              >
                {isInstalling ? 'Installing...' : 'Install App ✨'}
              </button>
            )}

            {platform === 'ios' && (
              <button className="install-btn-primary" onClick={handleDismiss}>
                Got it 👍
              </button>
            )}

            <button className="install-btn-dismiss" onClick={handleDismiss}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
