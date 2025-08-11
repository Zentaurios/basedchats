'use client'

import { useState, useTransition, useCallback, useMemo } from 'react'
import { useAddFrame, useOpenUrl, useMiniKit } from '@coinbase/onchainkit/minikit'
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from '@coinbase/onchainkit/identity'
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet'
import { CastFeed } from './CastFeed'
import { Button } from './ui/Button'
import { EnrichedCast } from '../../lib/cast-enrichment'
import { refreshCasts, searchCastsAction } from '../actions/casts'

interface AppClientProps {
  initialCasts: EnrichedCast[]
}

export function AppClient({ initialCasts }: AppClientProps) {
  const [casts, setCasts] = useState<EnrichedCast[]>(initialCasts)
  const [frameAdded, setFrameAdded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const { context } = useMiniKit()
  const addFrame = useAddFrame()
  const openUrl = useOpenUrl()

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame()
    setFrameAdded(Boolean(frameAdded))
  }, [addFrame])

  const handleRefresh = useCallback(() => {
    startTransition(async () => {
      try {
        setError(null)
        // Force refresh when user explicitly clicks refresh
        const newCasts = await refreshCasts(true)
        setCasts(newCasts)
      } catch (error) {
        console.error('Failed to refresh casts:', error)
        setError('Failed to refresh casts')
      }
    })
  }, [])

  const handleSearch = useCallback(async (query: string) => {
    startTransition(async () => {
      try {
        setError(null)
        if (query.trim()) {
          const results = await searchCastsAction(query)
          setCasts(results)
        } else {
          // Just reset to initial casts when search is cleared
          setCasts(initialCasts)
        }
      } catch (error) {
        console.error('Failed to search casts:', error)
        setError('Failed to search casts')
      }
    })
  }, [initialCasts])

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddFrame}
          className="text-base-blue hover:text-base-blue/80"
        >
          + Save
        </Button>
      )
    }

    if (frameAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-green animate-fade-out">
          <span className="text-green">✓</span>
          <span>Saved</span>
        </div>
      )
    }

    return null
  }, [context, frameAdded, handleAddFrame])

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground mini-app-theme">
      <div className="w-full max-w-2xl mx-auto px-4 py-3">
        <header className="flex justify-between items-center mb-6 h-11">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-base-blue">
              BasedChats
            </h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <Wallet className="z-10">
              <ConnectWallet className='bg-[#0000ff] hover:bg-black dark:hover:bg-white text-white hover:text-black dark:hover:text-white'>
                <Name className="text-inherit text-sm " />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address />
                  <EthBalance />
                </Identity>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>
            {saveFrameButton}
          </div>
        </header>

        <main className="flex-1 mb-6">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Base App Group Chats</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Discover active group chats on the Base App, curated by the Base community. Connect with builders, creators, and innovators in the onchain ecosystem.
            </p>
          </div>
          
          <CastFeed 
            casts={casts}
            loading={isPending}
            error={error ?? undefined}
            onRefresh={handleRefresh}
            onSearch={handleSearch}
          />
        </main>

        <footer className="mt-auto mb-4 pt-4 border-t border-border">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => openUrl("https://base.org/builders/minikit")}
            >
              Built on Base with MiniKit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => openUrl("https://base4everything.xyz/")}
            >
              Base is for [ Everything ]
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}
