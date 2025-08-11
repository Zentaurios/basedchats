// This is a Server Component - no 'use client'
import { Suspense } from 'react'
import { AppClient } from './components/AppClient'
import { MiniKitWrapper } from './components/MiniKitWrapper'
import { getCachedCasts } from './actions/casts'
import { CastCardSkeleton } from './components/CastCard'

async function CastData() {
  // This will now intelligently wait for data on first load
  const enrichedCasts = await getCachedCasts()
  return <AppClient initialCasts={enrichedCasts} />
}

export default function App() {
  return (
    <MiniKitWrapper>
      <Suspense fallback={
        <div className="flex flex-col min-h-screen bg-background text-foreground mini-app-theme">
          <div className="w-full max-w-2xl mx-auto px-4 py-3">
            <header className="flex justify-between items-center mb-6 h-11">
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-bold text-base-blue">
                  Base Chat Feed
                </h1>
              </div>
              <div className="w-32 h-8 bg-gray-15 dark:bg-gray-80 rounded animate-pulse" />
            </header>
            
            <main className="flex-1 mb-6">
              <div className="mb-6 text-center">
                <h2 className="text-lg font-semibold mb-2">Curated Group Chat Invites</h2>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Loading curated group chats on Farcaster...
                </p>
              </div>
              
              <div className="space-y-4 max-w-2xl mx-auto">
                {Array.from({ length: 3 }).map((_, i) => (
                  <CastCardSkeleton key={i} />
                ))}
              </div>
            </main>
          </div>
        </div>
      }>
        <CastData />
      </Suspense>
    </MiniKitWrapper>
  )
}
