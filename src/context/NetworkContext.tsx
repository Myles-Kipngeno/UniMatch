'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

interface NetworkContextType {
  isOnline: boolean
  isNetworkError: boolean
  reportNetworkError: () => void
  clearNetworkError: () => void
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [isNetworkError, setIsNetworkError] = useState<boolean>(false)

  useEffect(() => {
    // Initial check
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)
    }

    const handleOnline = () => {
      setIsOnline(true)
      setIsNetworkError(false)
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
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
