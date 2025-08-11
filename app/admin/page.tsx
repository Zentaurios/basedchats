// Server Component - Admin Page
import { getAdminSession } from './actions/auth'
import { getAllCasts } from '../../lib/utils'
import { enrichCastsWithMetadata } from '../../lib/cast-enrichment'
import { AdminPanelClient } from './components/AdminPanelClient'
// import { logAdminAction } from '../../lib/admin-auth'

// Force dynamic rendering to prevent build-time authentication issues
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  // Get session (middleware ensures user is authenticated)
  const session = await getAdminSession()
  
  // This should never happen due to middleware, but add safety check
  if (!session) {
    throw new Error('Admin session not found - middleware failure')
  }
  
  /* Log page access
  await logAdminAction(session, 'ACCESS_ADMIN_PAGE', {
    timestamp: Date.now()
  })*/
  
  // Fetch all casts for admin view and enrich with metadata
  const storedCasts = await getAllCasts()
  const casts = await enrichCastsWithMetadata(storedCasts)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-base-blue">BasedChats - Admin</h1>
          </div>
        </header>

        <main className="flex-1">
          <AdminPanelClient 
            initialCasts={casts}
            session={session}
          />
        </main>
      </div>
    </div>
  )
}
