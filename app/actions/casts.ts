'use server'

import { getActiveCasts, searchCasts } from '../../lib/utils'
import { enrichCastsWithMetadata, EnrichedCast } from '../../lib/cast-enrichment'

// Simple in-memory cache for enriched casts
let enrichedCastsCache: { data: EnrichedCast[]; timestamp: number } | null = null
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes (increased from 5)

/**
 * Get cached casts with smart loading strategy
 */
export async function getCachedCasts(): Promise<EnrichedCast[]> {
  const now = Date.now()
  
  // Case 1: Fresh cache - return immediately
  if (enrichedCastsCache && (now - enrichedCastsCache.timestamp < CACHE_DURATION)) {
    return enrichedCastsCache.data
  }
  
  // Case 2: Stale cache - return stale data, refresh in background
  if (enrichedCastsCache && enrichedCastsCache.data.length > 0) {
    // Start background refresh (don't await)
    backgroundRefreshCasts()
    return enrichedCastsCache.data
  }
  
  // Case 3: No cache at all - wait for fresh data (first load)
  try {
    const castsResponse = await getActiveCasts(1, 20)
    
    if (castsResponse.casts.length > 0) {
      const enrichedCasts = await enrichCastsWithMetadata(castsResponse.casts)
      
      // Cache the results
      enrichedCastsCache = {
        data: enrichedCasts,
        timestamp: now
      }
      
      return enrichedCasts
    }
    
    return []
    
  } catch {
    return []
  }
}

/**
 * Background refresh without blocking page load
 */
async function backgroundRefreshCasts(): Promise<void> {
  try {
    const castsResponse = await getActiveCasts(1, 20)
    
    if (castsResponse.casts.length > 0) {
      const enrichedCasts = await enrichCastsWithMetadata(castsResponse.casts)
      
      enrichedCastsCache = {
        data: enrichedCasts,
        timestamp: Date.now()
      }
    }
  } catch (error) {
    console.error('Background refresh failed:', error)
  }
}

/**
 * Server action to refresh casts with smart caching (only for explicit user refresh)
 */
export async function refreshCasts(forceRefresh: boolean = false): Promise<EnrichedCast[]> {
  try {
    const now = Date.now()
    
    // Check if we have valid cached data and don't force refresh
    if (!forceRefresh && enrichedCastsCache && (now - enrichedCastsCache.timestamp < CACHE_DURATION)) {
      return enrichedCastsCache.data
    }
        
    // Get basic cast data
    const castsResponse = await getActiveCasts(1, 20)
    
    // Enrich with metadata (only if we have casts to enrich)
    let enrichedCasts: EnrichedCast[] = []
    if (castsResponse.casts.length > 0) {
      enrichedCasts = await enrichCastsWithMetadata(castsResponse.casts)
      
      // Cache the results
      enrichedCastsCache = {
        data: enrichedCasts,
        timestamp: now
      }
    }
    
    return enrichedCasts
    
  } catch (error) {
    console.error('Failed to refresh casts:', error)
    // Return cached data if available, otherwise empty array
    return enrichedCastsCache?.data || []
  }
}

/**
 * Server action to search casts with rich metadata
 */
export async function searchCastsAction(query: string): Promise<EnrichedCast[]> {
  try {    
    // Search basic cast data
    const searchResults = await searchCasts(query, true)
    
    // Enrich search results with metadata
    const enrichedResults = await enrichCastsWithMetadata(searchResults)

    return enrichedResults
  } catch (error) {
    console.error('Failed to search casts:', error)
    return []
  }
}
