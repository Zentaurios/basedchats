'use client'

import { useState, useTransition } from 'react'
import { AdminSession } from '../../../lib/types'
import { EnrichedCast } from '../../../lib/cast-enrichment'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import { CastCard } from '../../components/CastCard'
import { addCastAction, removeCastAction, refreshAdminData, lookupCastByUrl, addCastFromLookup } from '../actions/casts'
import { logoutAdmin } from '../actions/auth'

interface AdminPanelClientProps {
  initialCasts: EnrichedCast[]
  session: AdminSession
}

export function AdminPanelClient({ initialCasts, session }: AdminPanelClientProps) {
  const [casts, setCasts] = useState<EnrichedCast[]>(initialCasts)
  const [newCastHash, setNewCastHash] = useState('')
  const [castUrl, setCastUrl] = useState('')
  type LookupResult = {
    success: boolean
    hash: string
    originalUrl?: string
    cast: {
      author: {
        display_name: string
        username: string
      }
      text?: string
      reactions?: {
        likes_count?: number
        recasts_count?: number
      }
    }
    error?: string
  } | null

  const [lookupResult, setLookupResult] = useState<LookupResult>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAddCast = () => {
    if (!newCastHash.trim()) {
      setError('Please enter a cast hash')
      return
    }

    startTransition(async () => {
      try {
        setError(null)
        setSuccess(null)
        
        const result = await addCastAction(newCastHash.trim())
        
        if (result.success) {
          setNewCastHash('')
          setSuccess('Cast added successfully!')
          // Refresh data
          const freshCasts = await refreshAdminData()
          setCasts(freshCasts)
        } else {
          setError(result.error || 'Failed to add cast')
        }
      } catch (error) {
        console.error('Failed to add cast:', error)
        setError('Failed to add cast')
      }
    })
  }

  const handleLookupCast = () => {
    if (!castUrl.trim()) {
      setError('Please enter a cast URL')
      return
    }

    startTransition(async () => {
      try {
        setError(null)
        setSuccess(null)
        setLookupResult(null)
        
        const result = await lookupCastByUrl(castUrl.trim())
        
        if (result.success) {
          if (result.hash && result.cast) {
            setLookupResult({
              success: true,
              hash: result.hash,
              originalUrl: result.originalUrl,
              cast: result.cast,
              error: result.error,
            })
            setSuccess('Cast found successfully!')
          } else {
            setError('Lookup succeeded but response is missing required data')
          }
        } else {
          setError(result.error || 'Failed to lookup cast')
        }
      } catch (error) {
        console.error('Failed to lookup cast:', error)
        setError('Failed to lookup cast')
      }
    })
  }

  const handleAddFromLookup = () => {
    if (lookupResult?.hash && lookupResult?.originalUrl) {
      startTransition(async () => {
        try {
          setError(null)
          setSuccess(null)
          
          const result = await addCastFromLookup(lookupResult.hash, lookupResult.originalUrl!)
          
          if (result.success) {
            setLookupResult(null)
            setCastUrl('')
            setSuccess('Cast added successfully!')
            // Refresh data
            const freshCasts = await refreshAdminData()
            setCasts(freshCasts)
          } else {
            setError(result.error || 'Failed to add cast')
          }
        } catch (error) {
          console.error('Failed to add cast from lookup:', error)
          setError('Failed to add cast')
        }
      })
    } else if (lookupResult?.hash) {
      // Fallback: just copy hash to form if no originalUrl
      setNewCastHash(lookupResult.hash)
      setSuccess('Hash copied to add cast form!')
    }
  }

  const handleRemoveCast = (hash: string) => {
    if (!confirm('Are you sure you want to remove this cast?')) {
      return
    }

    startTransition(async () => {
      try {
        setError(null)
        setSuccess(null)
        
        const result = await removeCastAction(hash)
        
        if (result.success) {
          setSuccess('Cast removed successfully!')
          // Refresh data
          const freshCasts = await refreshAdminData()
          setCasts(freshCasts)
        } else {
          setError(result.error || 'Failed to remove cast')
        }
      } catch (error) {
        console.error('Failed to remove cast:', error)
        setError('Failed to remove cast')
      }
    })
  }

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        setError(null)
        setSuccess(null)
        const freshCasts = await refreshAdminData()
        setCasts(freshCasts)
        setSuccess('Data refreshed!')
      } catch (error) {
        console.error('Failed to refresh data:', error)
        setError('Failed to refresh data')
      }
    })
  }

  const handleLogout = async () => {
    try {
      await logoutAdmin()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const handleExportData = async () => {
    try {
      setError(null)
      setSuccess(null)
      
      // Use the secure server-side export API
      const response = await fetch('/api/admin/export', {
        method: 'GET',
        credentials: 'include', // Include session cookies
        headers: {
          'Accept': 'text/csv',
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication expired. Please refresh the page and try again.')
          return
        }
        const errorData = await response.json().catch(() => ({ error: 'Export failed' }))
        setError(errorData.error || 'Failed to export data')
        return
      }

      // Get the CSV content from the secure API
      const csvContent = await response.text()
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `base-chat-feed-casts-${new Date().toISOString().split('T')[0]}.csv`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      // Create secure download
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      setSuccess('Data exported successfully!')
    } catch (error) {
      console.error('Export failed:', error)
      setError('Failed to export data. Please try again.')
    }
  }

  // Clear messages after 5 seconds
  useState(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null)
        setSuccess(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  })

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-3 sm:space-y-0">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-base-blue">Admin Panel</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Logged in as: <span className="font-mono text-xs break-all">{session.address}</span>
          </p>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <Button
            onClick={handleRefresh}
            variant="secondary"
            size="sm"
            loading={isPending}
            className="text-xs px-3 py-2"
          >
            Refresh
          </Button>
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="text-xs px-3 py-2"
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-3 bg-red/10 border border-red/20 rounded-lg">
          <p className="text-xs sm:text-sm text-red break-words">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="p-3 bg-green/10 border border-green/20 rounded-lg">
          <p className="text-xs sm:text-sm text-green break-words">{success}</p>
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Left Column - Actions */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6 order-2 lg:order-1">
          {/* Cast Lookup Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-600 text-sm sm:text-base">Cast URL Lookup</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Paste Base App URL of post here:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <Input
                placeholder="https://warpcast.com/username/0x123abc..."
                value={castUrl}
                onChange={(e) => setCastUrl(e.target.value)}
                className="text-xs sm:text-sm"
              />
              <Button
                onClick={handleLookupCast}
                loading={isPending}
                className="w-full text-xs sm:text-sm"
                variant="secondary"
              >
                Lookup Cast
              </Button>
              
              {lookupResult && lookupResult.success && (
                <div className="space-y-3 mt-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <label className="text-xs sm:text-sm font-medium">Cast Hash:</label>
                    <code className="block mt-1 p-2 bg-white dark:bg-gray-900 border rounded text-[10px] sm:text-xs font-mono break-all">
                      {lookupResult.hash}
                    </code>
                  </div>
                  
                  {lookupResult.originalUrl && (
                    <div>
                      <label className="text-xs sm:text-sm font-medium">Original URL:</label>
                      <code className="block mt-1 p-2 bg-white dark:bg-gray-900 border rounded text-[10px] sm:text-xs break-all">
                        {lookupResult.originalUrl}
                      </code>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium">Cast Details:</label>
                    <div className="text-[10px] sm:text-xs space-y-1">
                      <p><strong>Author:</strong> {lookupResult.cast.author.display_name} (@{lookupResult.cast.author.username})</p>
                      <p><strong>Text:</strong> {lookupResult.cast.text?.substring(0, 100)}{lookupResult.cast.text && lookupResult.cast.text.length > 100 ? '...' : ''}</p>
                      <p><strong>Likes:</strong> {lookupResult.cast.reactions?.likes_count || 0}</p>
                      <p><strong>Recasts:</strong> {lookupResult.cast.reactions?.recasts_count || 0}</p>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleAddFromLookup}
                    variant="primary"
                    size="sm"
                    className="w-full text-xs sm:text-sm"
                    loading={isPending}
                  >
                    {lookupResult?.originalUrl ? 'Add Cast with Original URL' : 'Copy Hash to Add Form'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Cast Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm sm:text-base">Add New Cast</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Add a Farcaster cast to the curated feed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <Input
                placeholder="0x1234567890abcdef..."
                value={newCastHash}
                onChange={(e) => setNewCastHash(e.target.value)}
                className="font-mono text-xs sm:text-sm"
              />
              <Button
                onClick={handleAddCast}
                loading={isPending}
                className="w-full text-xs sm:text-sm"
                variant="primary"
              >
                Add Cast
              </Button>
            </CardContent>
          </Card>

          {/* Export Data */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm sm:text-base">Export Data</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Download all cast data as CSV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleExportData}
                variant="secondary"
                className="w-full text-xs sm:text-sm"
                loading={isPending}
              >
                Download CSV Export
              </Button>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm sm:text-base">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs sm:text-sm">
                <span>Total Casts:</span>
                <span className="font-semibold">{casts.length}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span>Active:</span>
                <span className="font-semibold text-green">
                  {casts.filter(cast => cast.status === 'active').length}
                </span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span>Hidden:</span>
                <span className="font-semibold text-muted-foreground">
                  {casts.filter(cast => cast.status === 'hidden').length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Cast Management */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm sm:text-base">Manage Casts</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                View and moderate all casts in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {casts.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <p className="text-xs sm:text-sm text-muted-foreground">No casts found</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4 max-h-[70vh] sm:max-h-96 overflow-y-auto">
                  {casts.map((cast) => (
                    <CastCard
                      key={cast.hash}
                      cast={cast}
                      onViewCast={(hash) => console.log('Viewing cast:', hash)}
                      showMetadata={true}
                      isAdmin={true}
                      onRemove={handleRemoveCast}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
