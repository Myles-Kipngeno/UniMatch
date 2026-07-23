'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

interface ConfirmConfig {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDanger?: boolean
  onConfirm: () => void
  onCancel?: () => void
}

interface AlertConfig {
  title: string
  message: string
  buttonText?: string
  type?: 'success' | 'error' | 'info' | 'warning'
  onClose?: () => void
}

interface ModalContextType {
  toast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  confirm: (config: ConfirmConfig) => void
  alert: (config: AlertConfig | string) => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null)
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null)

  const toast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  const confirm = (config: ConfirmConfig) => {
    setConfirmConfig(config)
  }

  const alert = (config: AlertConfig | string) => {
    if (typeof config === 'string') {
      setAlertConfig({ title: 'Notice', message: config })
    } else {
      setAlertConfig(config)
    }
  }

  const handleConfirmAction = () => {
    if (confirmConfig) {
      confirmConfig.onConfirm()
      setConfirmConfig(null)
    }
  }

  const handleConfirmCancel = () => {
    if (confirmConfig) {
      if (confirmConfig.onCancel) confirmConfig.onCancel()
      setConfirmConfig(null)
    }
  }

  const handleAlertClose = () => {
    if (alertConfig && alertConfig.onClose) {
      alertConfig.onClose()
    }
    setAlertConfig(null)
  }

  return (
    <ModalContext.Provider value={{ toast, confirm, alert }}>
      {children}

      {/* ── Toast Container ── */}
      <div className="um-toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`um-toast um-toast-${t.type}`}>
            <span className="um-toast-icon">
              {t.type === 'success' && '✅'}
              {t.type === 'error' && '⚠️'}
              {t.type === 'warning' && '🔔'}
              {t.type === 'info' && '💬'}
            </span>
            <span className="um-toast-msg">{t.message}</span>
            <button className="um-toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>

      {/* ── Custom Alert Modal ── */}
      {alertConfig && (
        <div className="um-modal-overlay" onClick={handleAlertClose}>
          <div className="um-modal-card" onClick={e => e.stopPropagation()}>
            <div className="um-modal-icon">
              {alertConfig.type === 'success' ? '🎉' : alertConfig.type === 'error' ? '❌' : alertConfig.type === 'warning' ? '⚠️' : '🔔'}
            </div>
            <h3 className="um-modal-title">{alertConfig.title || 'Notification'}</h3>
            <p className="um-modal-message">{alertConfig.message}</p>
            <div className="um-modal-actions">
              <button className="um-btn-modal-primary" onClick={handleAlertClose}>
                {alertConfig.buttonText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Confirm Modal ── */}
      {confirmConfig && (
        <div className="um-modal-overlay" onClick={handleConfirmCancel}>
          <div className="um-modal-card" onClick={e => e.stopPropagation()}>
            <div className="um-modal-icon">
              {confirmConfig.isDanger ? '🗑️' : '❓'}
            </div>
            <h3 className="um-modal-title">{confirmConfig.title}</h3>
            <p className="um-modal-message">{confirmConfig.message}</p>
            <div className="um-modal-actions">
              <button className="um-btn-modal-secondary" onClick={handleConfirmCancel}>
                {confirmConfig.cancelText || 'Cancel'}
              </button>
              <button
                className={`um-btn-modal-primary ${confirmConfig.isDanger ? 'danger' : ''}`}
                onClick={handleConfirmAction}
              >
                {confirmConfig.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* ── Toasts ── */
        .um-toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 999999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
          max-width: 380px;
          width: calc(100vw - 40px);
        }
        .um-toast {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 14px;
          background: rgba(18, 16, 28, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(168, 85, 247, 0.3);
          color: #ffffff;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          animation: umToastIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
          line-height: 1.4;
        }
        .um-toast-success { border-color: rgba(16, 185, 129, 0.4); }
        .um-toast-error { border-color: rgba(239, 68, 68, 0.4); }
        .um-toast-warning { border-color: rgba(245, 158, 11, 0.4); }
        .um-toast-icon { font-size: 18px; flex-shrink: 0; }
        .um-toast-msg { flex: 1; min-width: 0; word-break: break-word; }
        .um-toast-close {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          font-size: 20px;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
        }

        @keyframes umToastIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Modals ── */
        .um-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 999999;
          background: rgba(8, 6, 16, 0.78);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: umOverlayIn 0.2s ease;
        }
        .um-modal-card {
          background: linear-gradient(145deg, #161426 0%, #0d0b18 100%);
          border: 1px solid rgba(168, 85, 247, 0.3);
          border-radius: 22px;
          width: 100%;
          max-width: 380px;
          padding: 24px;
          text-align: center;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7);
          animation: umModalIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }
        .um-modal-icon {
          font-size: 40px;
          margin-bottom: 12px;
          display: block;
        }
        .um-modal-title {
          font-size: 19px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 6px;
          letter-spacing: -0.3px;
        }
        .um-modal-message {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.65);
          margin: 0 0 22px;
          line-height: 1.55;
        }
        .um-modal-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        .um-btn-modal-secondary {
          flex: 1;
          padding: 12px 18px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: rgba(255, 255, 255, 0.85);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .um-btn-modal-secondary:hover {
          background: rgba(255, 255, 255, 0.12);
        }
        .um-btn-modal-primary {
          flex: 1;
          padding: 12px 18px;
          border-radius: 12px;
          background: linear-gradient(135deg, #7c3aed, #ec4899);
          border: none;
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(124, 58, 237, 0.35);
          transition: opacity 0.2s;
        }
        .um-btn-modal-primary:hover { opacity: 0.9; }
        .um-btn-modal-primary.danger {
          background: linear-gradient(135deg, #dc2626, #ef4444);
          box-shadow: 0 4px 16px rgba(220, 38, 38, 0.35);
        }

        @keyframes umOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes umModalIn {
          from { opacity: 0; transform: scale(0.9) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </ModalContext.Provider>
  )
}

export function useModal() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}
