import { redis } from './redis';
import { StoredCast } from './types';

/**
 * Helper function to safely parse Redis data (handles both strings and objects)
 */
function parseRedisData<T = unknown>(data: unknown): T | null {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse Redis data:', data, error);
      return null;
    }
  } else if (typeof data === 'object' && data !== null) {
    // Data is already parsed
    return data as T;
  } else {
    console.error('Unexpected data type from Redis:', typeof data, data);
    return null;
  }
}

/**
 * Utility function to backfill rich metadata for existing casts
 * This should be run once to upgrade existing casts in the database
 */

export async function backfillCastMetadata(): Promise<{ success: boolean; updated: number; errors: number }> {
  if (!redis) {
    throw new Error('Redis not available');
  }

  const neynarApiKey = process.env.NEYNAR_API_KEY;
  if (!neynarApiKey) {
    throw new Error('Neynar API key not configured');
  }

  let updated = 0;
  let errors = 0;

  try {
    // Get all cast hashes
    const allHashes = await redis.smembers('casts:all');
    
    console.log(`Found ${allHashes.length} casts to check for metadata backfill`);

    for (const hash of allHashes) {
      try {
        // Get existing cast
        const castData = await redis.get(`casts:${hash}`);
        if (!castData) continue;

        const cast = parseRedisData<StoredCast>(castData);
        if (!cast) continue;

        // Check if cast already has rich metadata
        if (cast.metadata?.author && cast.metadata?.username && cast.metadata?.authorPfp) {
          console.log(`Cast ${hash} already has rich metadata, skipping`);
          continue;
        }

        console.log(`Backfilling metadata for cast ${hash}...`);

        // Fetch rich metadata from Neynar
        const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${hash}&type=hash`, {
          method: 'GET',
          headers: {
            'x-api-key': neynarApiKey,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.cast) {
            const castData = data.cast;
            
            // Update cast with rich metadata
            cast.metadata = {
              ...cast.metadata, // Preserve any existing metadata
              author: castData.author?.display_name || castData.author?.username || 'Unknown',
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

            // Save updated cast
            await redis.set(`casts:${hash}`, JSON.stringify(cast));
            updated++;
            console.log(`✅ Updated cast ${hash} with rich metadata`);
          } else {
            console.log(`❌ No cast data found for ${hash}`);
            errors++;
          }
        } else {
          console.log(`❌ API request failed for ${hash}: ${response.status}`);
          errors++;
        }

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing cast ${hash}:`, error);
        errors++;
      }
    }

    return { success: true, updated, errors };
  } catch (error) {
    console.error('Failed to backfill cast metadata:', error);
    return { success: false, updated, errors };
  }
}
