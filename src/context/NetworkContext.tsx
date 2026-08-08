'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'

interface NetworkContextType {
  isOnline: boolean
  isNetworkError: boolean
  showReconnected: boolean
  reportNetworkError: () => void
  clearNetworkError: () => void
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [isNetworkError, setIsNetworkError] = useState<boolean>(false)
  const [showReconnected, setShowReconnected] = useState<boolean>(false)
  const wasOfflineRef = useRef(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Initial check
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)
      wasOfflineRef.current = !navigator.onLine
    }

    const handleOnline = () => {
      setIsOnline(true)
      setIsNetworkError(false)

      // Only show "Back online" if we were previously offline
      if (wasOfflineRef.current) {
        setShowReconnected(true)

        // Dispatch custom event for pages to refetch stale data
        window.dispatchEvent(new CustomEvent('unimatch:reconnect'))

        // Auto-dismiss "Back online" after 3 seconds
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => {
          setShowReconnected(false)
        }, 3000)
      }
      wasOfflineRef.current = false
    }

    const handleOffline = () => {
      setIsOnline(false)
      wasOfflineRef.current = true
      setShowReconnected(false)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [])

  const reportNetworkError = useCallback(() => {
    setIsNetworkError(true)
  }, [])

  const clearNetworkError = useCallback(() => {
    setIsNetworkError(false)
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)
    }
  }, [])

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        isNetworkError: !isOnline || isNetworkError,
        showReconnected,
        reportNetworkError,
        clearNetworkError,
      }}
    >
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  const context = useContext(NetworkContext)
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider')
  }
  return context
}
