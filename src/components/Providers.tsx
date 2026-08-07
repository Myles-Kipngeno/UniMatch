'use client'

import { ReactNode } from 'react'
import { ModalProvider } from './ModalContext'
import { AppCacheProvider } from '@/context/AppCacheContext'
import { NetworkProvider } from '@/context/NetworkContext'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <NetworkProvider>
      <AppCacheProvider>
        <ModalProvider>
          {children}
        </ModalProvider>
      </AppCacheProvider>
    </NetworkProvider>
  )
}
