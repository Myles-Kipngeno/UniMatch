'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface AppCacheState {
  dashboard: any | null
  discover: any | null
  matches: any | null
  chat: {
    conversations?: any[]
    messagesByMatchId?: Record<string, any[]>
  } | null
  notifications: any | null
  profile: Record<string, any> // keyed by userId or 'self'
  settings: any | null
}

interface AppCacheContextType {
  cache: AppCacheState
  getCache: (key: keyof AppCacheState, subKey?: string) => any
  setCache: (key: keyof AppCacheState, data: any, subKey?: string) => void
  clearCache: (key?: keyof AppCacheState) => void
}

const AppCacheContext = createContext<AppCacheContextType | undefined>(undefined)

export function AppCacheProvider({ children }: { children: ReactNode }) {
  const [cache, setCacheState] = useState<AppCacheState>({
    dashboard: null,
    discover: null,
    matches: null,
    chat: null,
    notifications: null,
    profile: {},
    settings: null,
  })

  const getCache = useCallback((key: keyof AppCacheState, subKey?: string) => {
    if (key === 'profile' || key === 'chat') {
      if (!cache[key]) return null
      if (subKey) {
        return (cache[key] as any)?.[subKey] ?? null
      }
    }
    return cache[key] ?? null
  }, [cache])

  const setCache = useCallback((key: keyof AppCacheState, data: any, subKey?: string) => {
    setCacheState((prev) => {
      if (key === 'profile') {
        const targetKey = subKey || 'self'
        return {
          ...prev,
          profile: {
            ...prev.profile,
            [targetKey]: data,
          },
        }
      }
      if (key === 'chat' && subKey) {
        const existingChat = prev.chat || { conversations: [], messagesByMatchId: {} }
        return {
          ...prev,
          chat: {
            ...existingChat,
            messagesByMatchId: {
              ...(existingChat.messagesByMatchId || {}),
              [subKey]: data,
            },
          },
        }
      }
      return {
        ...prev,
        [key]: data,
      }
    })
  }, [])

  const clearCache = useCallback((key?: keyof AppCacheState) => {
    if (key) {
      setCacheState((prev) => ({
        ...prev,
        [key]: key === 'profile' ? {} : null,
      }))
    } else {
      setCacheState({
        dashboard: null,
        discover: null,
        matches: null,
        chat: null,
        notifications: null,
        profile: {},
        settings: null,
      })
    }
  }, [])

  return (
    <AppCacheContext.Provider value={{ cache, getCache, setCache, clearCache }}>
      {children}
    </AppCacheContext.Provider>
  )
}

export function useAppCache() {
  const context = useContext(AppCacheContext)
  if (!context) {
    throw new Error('useAppCache must be used within an AppCacheProvider')
  }
  return context
}
