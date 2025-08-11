'use server'

import { revalidatePath } from 'next/cache'
import { getAdminSession } from './auth'
import { addCast, removeCast, getAllCasts } from '../../../lib/utils'
import { StoredCast } from '../../../lib/types'
import { enrichCastsWithMetadata, EnrichedCast } from '../../../lib/cast-enrichment'
// import { logAdminAction } from '../../../lib/admin-auth'
import { 
  sanitizeAndValidateCastHash, 
  sanitizeTextInput
} from '../../../lib/security/input-sanitization'

import { backfillCastMetadata } from '../../../lib/backfill'
import { NeynarAPIClient } from '@neynar/nodejs-sdk'

/**
 * Server action to add a new cast (admin only)
 * Authentication is enforced by middleware and layout
 */
export async function addCastAction(hash: string, originalUrl?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get admin session (middleware ensures this exists)
    const session = await getAdminSession()
    if (!session) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }
    
    // Enhanced input sanitization and validation
    const hashValidation = sanitizeAndValidateCastHash(hash)
    if (!hashValidation.isValid) {
      return {
        success: false,
        error: hashValidation.error || 'Invalid cast hash format'
      }
    }
    
    // Sanitize original URL if provided
    let sanitizedOriginalUrl: string | undefined
    if (originalUrl) {
      sanitizedOriginalUrl = sanitizeTextInput(originalUrl)
    }
    
    const sanitizedHash = hashValidation.sanitized

    /* Log the action
    await logAdminAction(session, 'ADD_CAST_ACTION', {
      hash: sanitizedHash,
      originalUrl: sanitizedOriginalUrl,
      timestamp: Date.now()
    })*/

    // Add the cast using sanitized values
    const result = await addCast(sanitizedHash, session.address, undefined, sanitizedOriginalUrl)
    
    if (!result) {
      return {
        success: false,
        error: 'Failed to add cast. It may already exist.'
      }
    }

    // Revalidate admin and public pages
    revalidatePath('/admin')
    revalidatePath('/')
    
    // Send notifications to all users with notifications enabled using Neynar
    try {
      const neynarApiKey = process.env.NEYNAR_API_KEY
      if (neynarApiKey) {
        const client = new NeynarAPIClient({ apiKey: neynarApiKey })
        
        await client.publishFrameNotifications({
          targetFids: [], // Empty array = send to all users with notifications enabled
          notification: {
            title: '🎉 New Group Chat Added!',
            body: 'A new Base group chat has been added to the feed. Check it out!',
            target_url: process.env.NEXT_PUBLIC_URL || ''
          }
        })
        
        console.log(`Sent notification for new cast: ${sanitizedHash}`)
      } else {
        console.warn('NEYNAR_API_KEY not configured - skipping notifications')
      }
    } catch (notificationError) {
      console.error('Failed to send cast notifications:', notificationError)
      // Don't fail the cast addition if notifications fail
    }
    
    return { success: true }
  } catch (error) {
    console.error('Failed to add cast:', error)
    return {
      success: false,
      error: 'Failed to add cast'
    }
  }
}

/**
 * Server action to remove a cast (admin only)
 * Authentication is enforced by middleware and layout
 */
export async function removeCastAction(hash: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get admin session (middleware ensures this exists)
    const session = await getAdminSession()
    if (!session) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }
    
    /* Log the action
    await logAdminAction(session, 'REMOVE_CAST_ACTION', {
      hash,
      timestamp: Date.now()
    })*/
    
    // Remove the cast
    const result = await removeCast(hash)
    
    if (!result) {
      return {
        success: false,
        error: 'Cast not found or already removed'
      }
    }

    // Revalidate admin and public pages
    revalidatePath('/admin')
    revalidatePath('/')
    
    return { success: true }
  } catch (error) {
    console.error('Failed to remove cast:', error)
    return {
      success: false,
      error: 'Failed to remove cast'
    }
  }
}

/**
 * Server action to get all casts for admin view
 * Authentication is enforced by middleware and layout
 */
export async function getAdminCasts(): Promise<StoredCast[]> {
  try {
    // Get admin session (middleware ensures this exists)
    const session = await getAdminSession()
    if (!session) {
      return []
    }
    
    /* Log the action
    await logAdminAction(session, 'VIEW_ADMIN_CASTS', {
      timestamp: Date.now()
    })*/
    
    // Get all casts (including hidden ones)
    const casts = await getAllCasts()
    
    return casts
  } catch (error) {
    console.error('Failed to get admin casts:', error)
    return []
  }
}

/**
 * Server action to add a cast from lookup results
 * Authentication is enforced by middleware and layout
 */
export async function addCastFromLookup(hash: string, originalUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get admin session (middleware ensures this exists)
    const session = await getAdminSession()
    if (!session) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }
    
    // Validate hash format
    if (!hash.match(/^0x[a-fA-F0-9]{40}$/)) {
      return {
        success: false,
        error: 'Invalid cast hash format. Must be 40-character hex string starting with 0x'
      }
    }

    /* Log the action
    await logAdminAction(session, 'ADD_CAST_FROM_LOOKUP', {
      hash,
      originalUrl,
      timestamp: Date.now()
    })*/

    // Add the cast with originalUrl (no metadata extraction needed)
    const result = await addCast(hash, session.address, undefined, originalUrl)
    
    if (!result) {
      return {
        success: false,
        error: 'Failed to add cast. It may already exist.'
      }
    }

    // Revalidate admin and public pages
    revalidatePath('/admin')
    revalidatePath('/')
    
    // Send notifications to all users with notifications enabled using Neynar
    try {
      const neynarApiKey = process.env.NEYNAR_API_KEY
      if (neynarApiKey) {
        const client = new NeynarAPIClient({ apiKey: neynarApiKey })
        
        await client.publishFrameNotifications({
          targetFids: [], // Empty array = send to all users with notifications enabled
          notification: {
            title: '🎉 New Group Chat Added!',
            body: 'A new Base group chat has been added to the feed. Check it out!',
            target_url: process.env.NEXT_PUBLIC_URL || ''
          }
        })
        
        console.log(`Sent notification for new cast: ${hash}`)
      } else {
        console.warn('NEYNAR_API_KEY not configured - skipping notifications')
      }
    } catch (notificationError) {
      console.error('Failed to send cast notifications:', notificationError)
      // Don't fail the cast addition if notifications fail
    }
    
    return { success: true }
  } catch (error) {
    console.error('Failed to add cast from lookup:', error)
    return {
      success: false,
      error: 'Failed to add cast'
    }
  }
}

/**
 * Server action to refresh admin data
 * Authentication is enforced by middleware and layout
 */
export async function refreshAdminData(): Promise<EnrichedCast[]> {
  try {
    // Get admin session (middleware ensures this exists)
    const session = await getAdminSession()
    if (!session) {
      return []
    }
    
    /* Log the action
    await logAdminAction(session, 'REFRESH_ADMIN_DATA', {
      timestamp: Date.now()
    })*/
    
    // Revalidate the page
    revalidatePath('/admin')
    
    // Get fresh data and enrich with metadata
    const storedCasts = await getAllCasts()
    
    // Add a small delay to ensure recently added casts are available for enrichment
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return await enrichCastsWithMetadata(storedCasts)
  } catch (error) {
    console.error('Failed to refresh admin data:', error)
    return []
  }
}

/**
 * Server action to lookup cast information by URL
 * Handles both Coinbase wallet URLs and Farcaster URLs
 * Authentication is enforced by middleware and layout
 */
interface LookupCastResult {
  success: boolean;
  cast?: {
    hash: string;
    text?: string;
    author: {
      display_name: string;
      username: string;
      fid: number;
      pfp_url?: string;
    };
    reactions?: {
      likes_count?: number;
      recasts_count?: number;
    };
    timestamp?: string;
    embeds?: unknown[];
  };
  hash?: string;
  originalUrl?: string;
  error?: string;
}

export async function lookupCastByUrl(url: string): Promise<LookupCastResult> {
  try {
    // Get admin session (middleware ensures this exists)
    const session = await getAdminSession()
    if (!session) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }
    
    // Validate URL format
    if (!url.trim()) {
      return {
        success: false,
        error: 'Please enter a cast URL'
      }
    }

    /* Log the action
    await logAdminAction(session, 'LOOKUP_CAST_BY_URL', {
      url,
      timestamp: Date.now()
    })*/

    // Initialize Neynar API key
    const neynarApiKey = process.env.NEYNAR_API_KEY
    if (!neynarApiKey) {
      return {
        success: false,
        error: 'Neynar API key not configured'
      }
    }

    let castHash: string
    const originalUrl = url
    
    // Handle different URL formats
    if (url.includes('wallet.coinbase.com/post/')) {
      // Extract hash from coinbase URL: https://wallet.coinbase.com/post/0x...
      const match = url.match(/\/post\/(0x[a-fA-F0-9]+)$/)
      if (!match) {
        return {
          success: false,
          error: 'Invalid Coinbase wallet URL format'
        }
      }
      castHash = match[1]
      
      // Try to lookup by hash directly first
      try {
        const hashResponse = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash`, {
          method: 'GET',
          headers: {
            'x-api-key': neynarApiKey,
            'Content-Type': 'application/json'
          }
        })
        
        if (hashResponse.ok) {
          const hashData = await hashResponse.json()
          if (hashData.cast) {
            return {
              success: true,
              cast: hashData.cast,
              hash: hashData.cast.hash,
              originalUrl: originalUrl // Store original coinbase URL
            }
          }
        }
      } catch {
        console.log('Hash lookup failed, trying truncated hash approach...')
      }
      
      // If direct hash lookup fails, try truncated hash approach
      // Truncate to first 10 characters (0x + 8 hex chars)
      const truncatedHash = castHash.substring(0, 10)
      
      // We need the username - try a few common approaches
      const commonUsernames = ['thebaron', 'webb3fitty', 'quigs'] // Based on your admin list
      
      for (const username of commonUsernames) {
        try {
          const farcasterUrl = `https://farcaster.xyz/${username}/${truncatedHash}`
          const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${farcasterUrl}&type=url`, {
            method: 'GET',
            headers: {
              'x-api-key': neynarApiKey,
              'Content-Type': 'application/json'
            }
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.cast) {
              return {
                success: true,
                cast: data.cast,
                hash: data.cast.hash,
                originalUrl: originalUrl // Store original coinbase URL
              }
            }
          }
        } catch {
          continue // Try next username
        }
      }
      
      return {
        success: false,
        error: 'Could not find cast. Please provide the Farcaster username or try the full Farcaster URL.'
      }
      
    } else if (url.includes('farcaster.xyz') || url.includes('warpcast.com')) {
      // Handle standard Farcaster URLs
      const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${url}&type=url`, {
        method: 'GET',
        headers: {
          'x-api-key': neynarApiKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.cast) {
        return {
          success: false,
          error: 'Cast not found'
        }
      }

      return {
        success: true,
        cast: data.cast,
        hash: data.cast.hash,
        originalUrl: url
      }
    } else {
      return {
        success: false,
        error: 'Please enter a valid Coinbase wallet URL (wallet.coinbase.com/post/...) or Farcaster URL'
      }
    }

  } catch (error) {
    console.error('Failed to lookup cast:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to lookup cast'
    }
  }
}

/**
 * Server action to backfill metadata for existing casts
 * Authentication is enforced by middleware and layout
 */
export async function backfillMetadataAction(): Promise<{ success: boolean; updated?: number; errors?: number; error?: string }> {
  try {
    // Get admin session (middleware ensures this exists)
    const session = await getAdminSession()
    if (!session) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }
    
    /* Log the action
    await logAdminAction(session, 'BACKFILL_METADATA', {
      timestamp: Date.now()
    })*/
    
    // Run the backfill
    const result = await backfillCastMetadata()
    
    if (result.success) {
      // Revalidate admin and public pages
      revalidatePath('/admin')
      revalidatePath('/')
      
      return {
        success: true,
        updated: result.updated,
        errors: result.errors
      }
    } else {
      return {
        success: false,
        error: 'Backfill process failed'
      }
    }
  } catch (error) {
    console.error('Failed to run backfill:', error)
    return {
      success: false,
      error: 'Failed to run backfill'
    }
  }
}
