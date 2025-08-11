// Cast Enrichment Service - Dynamically fetch rich metadata for public feed

import { StoredCast } from './types';

// Define the enriched metadata structure
interface EnrichedMetadata {
  author: string;
  username?: string;
  authorFid?: number;
  authorPfp?: string;
  content: string;
  timestamp: number;
  parentHash?: string;
  embeds?: Array<{
    type: string;
    url?: string;
    metadata?: {
      title?: string;
      description?: string;
      image?: string;
    };
  }>;
  reactions: {
    likes: number;
    recasts: number;
    replies: number;
  };
}

// EnrichedCast with properly typed metadata
export interface EnrichedCast extends Omit<StoredCast, 'metadata'> {
  metadata?: EnrichedMetadata;
}

/**
 * Fetch rich metadata for a single cast hash
 */
async function fetchCastMetadata(hash: string, retries: number = 2): Promise<EnrichedCast['metadata'] | null> {
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  
  if (!neynarApiKey) {
    console.warn('Neynar API key not configured');
    return null;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Add delay for retries to allow API propagation
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
      
      const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${hash}&type=hash`, {
        method: 'GET',
        headers: {
          'x-api-key': neynarApiKey,
          'Content-Type': 'application/json'
        },
        // Add caching for better performance
        next: { revalidate: 300 } // Cache for 5 minutes
      });

      if (!response.ok) {
        if (attempt === retries) {
          console.warn(`Neynar API request failed for ${hash}: ${response.status}`);
        }
        continue;
      }

      const data = await response.json();
      
      if (!data.cast) {
        if (attempt === retries) {
          console.warn(`No cast data found for ${hash}`);
        }
        continue;
      }

      const castData = data.cast;
      
      return {
        author: castData.author?.display_name || castData.author?.username || 'Unknown Author',
        username: castData.author?.username,
        authorFid: castData.author?.fid,
        authorPfp: castData.author?.pfp_url,
        content: castData.text || '',
        timestamp: castData.timestamp ? new Date(castData.timestamp).getTime() : Date.now(),
        parentHash: castData.parent_hash,
        embeds: castData.embeds?.map((embed: Record<string, unknown>) => ({
          type: embed.cast ? 'cast' : (embed.url ? 'link' : 'unknown'),
          url: embed.url as string,
          metadata: {
            title: (embed.metadata as Record<string, unknown>)?.title as string,
            description: (embed.metadata as Record<string, unknown>)?.description as string,
            image: (embed.metadata as Record<string, unknown>)?.image as string
          }
        })) || [],
        reactions: {
          likes: castData.reactions?.likes_count || 0,
          recasts: castData.reactions?.recasts_count || 0,
          replies: castData.replies?.count || 0
        }
      };

    } catch (error) {
      if (attempt === retries) {
        console.error(`Failed to fetch metadata for cast ${hash}:`, error);
      }
    }
  }
  
  return null;
}

/**
 * Create fallback metadata for casts that fail to load
 */
function createFallbackMetadata(cast: StoredCast): EnrichedCast['metadata'] {
  return {
    author: 'Unknown Author',
    content: 'Group chat invite',
    timestamp: cast.addedAt,
    reactions: {
      likes: 0,
      recasts: 0,
      replies: 0
    }
  };
}

/**
 * Enrich a list of casts with metadata from Neynar API
 * Uses parallel fetching for better performance
 */
export async function enrichCastsWithMetadata(casts: StoredCast[]): Promise<EnrichedCast[]> {  
  // Fetch metadata for all casts in parallel (with rate limiting)
  const enrichmentPromises = casts.map(async (cast, index) => {
    // Add small delay to avoid rate limiting (stagger requests)
    await new Promise(resolve => setTimeout(resolve, index * 50));
    
    const metadata = await fetchCastMetadata(cast.hash);
    
    return {
      ...cast,
      metadata: metadata || createFallbackMetadata(cast)
    } as EnrichedCast;
  });

  try {
    const enrichedCasts = await Promise.all(enrichmentPromises);

    return enrichedCasts;
    
  } catch (error) {
    console.error('Failed to enrich casts:', error);
    
    // Return casts with fallback metadata if enrichment fails
    return casts.map(cast => ({
      ...cast,
      metadata: createFallbackMetadata(cast)
    })) as EnrichedCast[];
  }
}

/**
 * Enrich a single cast with metadata (for individual loading)
 */
export async function enrichSingleCast(cast: StoredCast): Promise<EnrichedCast> {
  const metadata = await fetchCastMetadata(cast.hash);
  
  return {
    ...cast,
    metadata: metadata || createFallbackMetadata(cast)
  } as EnrichedCast;
}

/**
 * Create a minimal enriched cast from stored cast data for admin view
 * This ensures type compatibility without requiring API calls
 */
export function createMinimalEnrichedCast(storedCast: StoredCast): EnrichedCast {
  return {
    ...storedCast,
    metadata: {
      author: storedCast.metadata?.author || 'Unknown Author',
      username: storedCast.metadata?.username,
      authorFid: storedCast.metadata?.authorFid,
      authorPfp: storedCast.metadata?.authorPfp,
      content: storedCast.metadata?.content || 'Cast content',
      timestamp: storedCast.metadata?.timestamp || storedCast.addedAt,
      parentHash: storedCast.metadata?.parentHash,
      // Properly preserve all embeds with their full structure
      embeds: storedCast.metadata?.embeds?.map(embed => ({
        type: embed.type as 'image' | 'video' | 'link' | 'cast',
        url: embed.url,
        metadata: {
          title: embed.metadata?.title,
          description: embed.metadata?.description,
          image: embed.metadata?.image
        }
      })) || [],
      reactions: {
        likes: storedCast.metadata?.reactions?.likes || 0,
        recasts: storedCast.metadata?.reactions?.recasts || 0,
        replies: storedCast.metadata?.reactions?.replies || 0
      }
    }
  };
}

/**
 * Convert an array of StoredCast to EnrichedCast for admin views
 */
export function convertStoredCastsToEnriched(storedCasts: StoredCast[]): EnrichedCast[] {
  return storedCasts.map(createMinimalEnrichedCast);
}

/**
 * Client-side cache for enriched casts
 * Prevents re-fetching the same data on page refresh
 */
export class CastCache {
  private cache = new Map<string, EnrichedCast['metadata']>();
  private cacheTimestamps = new Map<string, number>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  set(hash: string, metadata: EnrichedCast['metadata']) {
    this.cache.set(hash, metadata);
    this.cacheTimestamps.set(hash, Date.now());
  }

  get(hash: string): EnrichedCast['metadata'] | null {
    const timestamp = this.cacheTimestamps.get(hash);
    if (!timestamp || Date.now() - timestamp > this.CACHE_DURATION) {
      this.cache.delete(hash);
      this.cacheTimestamps.delete(hash);
      return null;
    }
    return this.cache.get(hash) || null;
  }

  clear() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
}

// Export a global cache instance
export const castCache = new CastCache();
