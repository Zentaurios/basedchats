'use client'

import { useMiniKit } from '@coinbase/onchainkit/minikit'
import { useEffect } from 'react'

interface MiniKitWrapperProps {
  children: React.ReactNode
}

export function MiniKitWrapper({ children }: MiniKitWrapperProps) {
  const { setFrameReady, isFrameReady } = useMiniKit()

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady()
    }
  }, [setFrameReady, isFrameReady])

  return <>{children}</>
}
