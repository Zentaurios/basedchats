// Client-side API hook for fetching casts with pagination
'use client'

import { useState, useEffect, useCallback } from 'react'
import { EnrichedCast } from '../../lib/cast-enrichment'

export interface CastsApiResponse {
  success: boolean
  casts: EnrichedCast[]
  total: number
  page?: number
  limit?: number
  error?: string
}

export interface UseCastsApiOptions {
  page?: number
  limit?: number
  query?: string
  autoFetch?: boolean
}

export function useCastsApi(options: UseCastsApiOptions = {}) {
  const {
    page = 1,
    limit = 20,
    query = '',
    autoFetch = true
  } = options

  const [data, setData] = useState<CastsApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCasts = useCallback(async (
    fetchPage: number = page,
    fetchLimit: number = limit,
    fetchQuery: string = query
  ) => {
    try {
      setLoading(true)
      setError(null)

      // Build query parameters
      const params = new URLSearchParams({
        page: fetchPage.toString(),
        limit: fetchLimit.toString()
      })

      if (fetchQuery.trim()) {
        params.append('query', fetchQuery.trim())
      }

      const response = await fetch(`/api/casts?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result: CastsApiResponse = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch casts')
      }

      setData(result)
      
      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('❌ API fetch failed:', errorMessage)
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [page, limit, query])

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch) {
      fetchCasts()
    }
  }, [autoFetch, fetchCasts])

  // Pagination helpers
  const nextPage = useCallback(() => {
    if (data && data.page && data.total) {
      const currentPage = data.page
      const totalPages = Math.ceil(data.total / limit)
      if (currentPage < totalPages) {
        return fetchCasts(currentPage + 1, limit, query)
      }
    }
    return Promise.resolve(null)
  }, [data, limit, query, fetchCasts])

  const prevPage = useCallback(() => {
    if (data && data.page && data.page > 1) {
      return fetchCasts(data.page - 1, limit, query)
    }
    return Promise.resolve(null)
  }, [data, limit, query, fetchCasts])

  const goToPage = useCallback((targetPage: number) => {
    return fetchCasts(targetPage, limit, query)
  }, [limit, query, fetchCasts])

  const searchCasts = useCallback((searchQuery: string) => {
    return fetchCasts(1, limit, searchQuery) // Reset to page 1 for new search
  }, [limit, fetchCasts])

  const refetch = useCallback(() => {
    return fetchCasts(page, limit, query)
  }, [page, limit, query, fetchCasts])

  // Computed properties
  const currentPage = data?.page || page
  const totalPages = data ? Math.ceil(data.total / limit) : 0
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  return {
    // Data
    casts: data?.casts || [],
    total: data?.total || 0,
    
    // State
    loading,
    error,
    
    // Pagination info
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    
    // Actions
    fetchCasts,
    nextPage,
    prevPage,
    goToPage,
    searchCasts,
    refetch
  }
}

// Hook for debugging API calls
export function useApiDebug() {
  const [calls, setCalls] = useState<Array<{
    url: string
    timestamp: number
    status: 'pending' | 'success' | 'error'
    duration?: number
    result?: unknown
    error?: string
  }>>([])

  const logCall = useCallback((url: string) => {
    const callId = Date.now()
    setCalls(prev => [...prev, {
      url,
      timestamp: callId,
      status: 'pending'
    }])
    
    return {
      success: (result: unknown, duration: number) => {
        setCalls(prev => prev.map(call => 
          call.timestamp === callId 
            ? { ...call, status: 'success' as const, duration, result }
            : call
        ))
      },
      error: (error: string, duration: number) => {
        setCalls(prev => prev.map(call => 
          call.timestamp === callId 
            ? { ...call, status: 'error' as const, duration, error }
            : call
        ))
      }
    }
  }, [])

  const clearLogs = useCallback(() => {
    setCalls([])
  }, [])

  return {
    calls,
    logCall,
    clearLogs
  }
}
