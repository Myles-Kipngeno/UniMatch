'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'

// Bump this when the cache shape changes to invalidate stale localStorage data
const CACHE_VERSION = 1
const STORAGE_KEY = 'unimatch_cache'
const STORAGE_VERSION_KEY = 'unimatch_cache_version'

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

const EMPTY_CACHE: AppCacheState = {
  dashboard: null,
  discover: null,
  matches: null,
  chat: null,
  notifications: null,
  profile: {},
  settings: null,
}

/** Try to hydrate cache from localStorage */
function hydrateFromStorage(): AppCacheState {
  if (typeof window === 'undefined') return { ...EMPTY_CACHE }
  try {
    const version = localStorage.getItem(STORAGE_VERSION_KEY)
    if (version !== String(CACHE_VERSION)) {
      // Version mismatch — discard stale cache
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(STORAGE_VERSION_KEY, String(CACHE_VERSION))
      return { ...EMPTY_CACHE }
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        dashboard: parsed.dashboard ?? null,
        discover: parsed.discover ?? null,
        matches: parsed.matches ?? null,
        chat: parsed.chat ?? null,
        notifications: parsed.notifications ?? null,
        profile: parsed.profile ?? {},
        settings: parsed.settings ?? null,
      }
    }
  } catch (e) {
    console.warn('[AppCache] Failed to hydrate from localStorage:', e)
  }
  return { ...EMPTY_CACHE }
}

/** Persist cache to localStorage (debounced) */
function persistToStorage(cache: AppCacheState) {
  if (typeof window === 'undefined') return
  try {
    // Limit chat messages to last 50 per conversation to stay under quota
    const sanitized = { ...cache }
    if (sanitized.chat?.messagesByMatchId) {
      const trimmed: Record<string, any[]> = {}
      for (const [matchId, msgs] of Object.entries(sanitized.chat.messagesByMatchId)) {
        trimmed[matchId] = Array.isArray(msgs) ? msgs.slice(-50) : msgs
      }
      sanitized.chat = { ...sanitized.chat, messagesByMatchId: trimmed }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
    localStorage.setItem(STORAGE_VERSION_KEY, String(CACHE_VERSION))
  } catch (e) {
    // QuotaExceededError or other — degrade gracefully
    console.warn('[AppCache] Failed to persist to localStorage:', e)
  }
}

const AppCacheContext = createContext<AppCacheContextType | undefined>(undefined)

export function AppCacheProvider({ children }: { children: ReactNode }) {
  const [cache, setCacheState] = useState<AppCacheState>(hydrateFromStorage)

  // Debounced localStorage write
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cacheRef = useRef(cache)
  cacheRef.current = cache

  const schedulePersist = useCallback(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      persistToStorage(cacheRef.current)
    }, 500)
  }, [])

  // Persist whenever cache changes (debounced)
  useEffect(() => {
    schedulePersist()
  }, [cache, schedulePersist])

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
      setCacheState({ ...EMPTY_CACHE })
    }
    // Also clear localStorage
    if (typeof window !== 'undefined') {
      try {
        if (key) {
          // Partial clear — re-persist
          setTimeout(() => persistToStorage(cacheRef.current), 100)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch (e) {
        console.warn('[AppCache] Failed to clear localStorage:', e)
      }
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
