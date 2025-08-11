// BasedChats Mini App - Utility Functions

import { redis } from './redis';
import { StoredCast, CastsResponse, ExportConfig } from './types';

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
 * Add a new cast to the system
 */
export async function addCast(
  hash: string,
  adminEns: string,
  metadata?: StoredCast['metadata'],
  originalUrl?: string
): Promise<StoredCast | null> {
  if (!redis) {
    throw new Error('Redis not available');
  }
  
  const cast: StoredCast = {
    hash,
    addedBy: adminEns,
    addedAt: Date.now(),
    originalUrl,
    metadata,
    status: 'active'
  };
  
  try {
    // Store cast data
    await redis.set(`casts:${hash}`, JSON.stringify(cast));
    
    // Add to active casts set
    await redis.sadd('casts:active', hash);
    
    // Add to all casts set
    await redis.sadd('casts:all', hash);
    
    return cast;
  } catch (error) {
    console.error('Failed to add cast:', error);
    return null;
  }
}

/**
 * Remove/hide a cast from the active feed
 */
export async function removeCast(hash: string): Promise<boolean> {
  if (!redis) {
    throw new Error('Redis not available');
  }
  
  try {
    // Get existing cast
    const castData = await redis.get(`casts:${hash}`);
    if (!castData) {
      return false;
    }
    
    const cast = parseRedisData<StoredCast>(castData);
    if (!cast) {
      return false;
    }
    
    cast.status = 'hidden';
    
    // Update cast status
    await redis.set(`casts:${hash}`, JSON.stringify(cast));
    
    // Remove from active casts set
    await redis.srem('casts:active', hash);
    
    return true;
  } catch (error) {
    console.error('Failed to remove cast:', error);
    return false;
  }
}

/**
 * Get all active casts for public feed
 */
export async function getActiveCasts(
  page: number = 1,
  limit: number = 20
): Promise<CastsResponse<StoredCast>> {
  if (!redis) {
    return {
      success: false,
      casts: [],
      total: 0
    };
  }
  
  try {
    // Get active cast hashes
    const activeHashes = await redis.smembers('casts:active');
    
    if (!activeHashes || activeHashes.length === 0) {
      return {
        success: true,
        casts: [],
        total: 0,
        page,
        limit
      };
    }
    
    // Get cast data for all hashes
    const castKeys = activeHashes.map(hash => `casts:${hash}`);
    const castDataArray = await redis.mget(...castKeys);
    
    const casts: StoredCast[] = castDataArray
      .filter(data => data !== null)
      .map(data => parseRedisData<StoredCast>(data))
      .filter((cast): cast is StoredCast => cast !== null && cast.status === 'active')
      .sort((a, b) => b.addedAt - a.addedAt); // Sort by newest first
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCasts = casts.slice(startIndex, endIndex);
    
    return {
      success: true,
      casts: paginatedCasts,
      total: casts.length,
      page,
      limit
    };
  } catch (error) {
    console.error('Failed to get active casts:', error);
    return {
      success: false,
      casts: [],
      total: 0
    };
  }
}

/**
 * Get all casts (for admin view)
 */
export async function getAllCasts(): Promise<StoredCast[]> {
  if (!redis) {
    return [];
  }
  
  try {
    // Get all cast hashes
    const allHashes = await redis.smembers('casts:all');
    
    if (!allHashes || allHashes.length === 0) {
      return [];
    }
    
    // Get cast data for all hashes
    const castKeys = allHashes.map(hash => `casts:${hash}`);
    const castDataArray = await redis.mget(...castKeys);
    
    const casts: StoredCast[] = castDataArray
      .filter(data => data !== null)
      .map(data => parseRedisData<StoredCast>(data))
      .filter((cast): cast is StoredCast => cast !== null)
      .sort((a, b) => b.addedAt - a.addedAt); // Sort by newest first
    
    return casts;
  } catch (error) {
    console.error('Failed to get all casts:', error);
    return [];
  }
}

/**
 * Check if a cast already exists
 */
export async function castExists(hash: string): Promise<boolean> {
  if (!redis) {
    return false;
  }
  
  try {
    const exists = await redis.exists(`casts:${hash}`);
    return Boolean(exists);
  } catch (error) {
    console.error('Failed to check cast existence:', error);
    return false;
  }
}

/**
 * Get a specific cast by hash
 */
export async function getCast(hash: string): Promise<StoredCast | null> {
  if (!redis) {
    return null;
  }
  
  try {
    const castData = await redis.get(`casts:${hash}`);
    if (!castData) {
      return null;
    }
    
    // Handle both string and object responses from Redis
    if (typeof castData === 'string') {
      try {
        return JSON.parse(castData);
      } catch (error) {
        console.error('Failed to parse cast data in getCast:', castData, error);
        return null;
      }
    } else if (typeof castData === 'object' && castData !== null) {
      // Data is already parsed
      return castData as StoredCast;
    } else {
      console.error('Unexpected data type from Redis in getCast:', typeof castData, castData);
      return null;
    }
  } catch (error) {
    console.error('Failed to get cast:', error);
    return null;
  }
}

/**
 * Search and filter casts
 */
export async function searchCasts(
  query: string = '',
  activeOnly: boolean = true
): Promise<StoredCast[]> {
  if (!redis) {
    return [];
  }
  
  try {
    const casts = activeOnly ? await getActiveCasts() : { casts: await getAllCasts() };
    
    if (!query.trim()) {
      return casts.casts;
    }
    
    const lowercaseQuery = query.toLowerCase();
    
    return casts.casts.filter(cast => {
      // Search in metadata content
      if (cast.metadata?.content?.toLowerCase().includes(lowercaseQuery)) {
        return true;
      }
      
      // Search in metadata author
      if (cast.metadata?.author?.toLowerCase().includes(lowercaseQuery)) {
        return true;
      }
      
      // Search in hash
      if (cast.hash.toLowerCase().includes(lowercaseQuery)) {
        return true;
      }
      
      // Search in addedBy
      if (cast.addedBy.toLowerCase().includes(lowercaseQuery)) {
        return true;
      }
      
      return false;
    });
  } catch (error) {
    console.error('Failed to search casts:', error);
    return [];
  }
}

/**
 * Generate CSV export data
 */
export function generateCSVExport(
  casts: StoredCast[],
  config: ExportConfig
): string {
  const headers = [
    'Hash',
    'Added By',
    'Added At',
    'Status',
    ...(config.includeMetadata ? ['Author', 'Content', 'Cast Timestamp'] : [])
  ];
  
  const rows = casts
    .filter(cast => {
      if (config.dateRange) {
        const castDate = new Date(cast.addedAt);
        return castDate >= config.dateRange.start && castDate <= config.dateRange.end;
      }
      return true;
    })
    .map(cast => {
      const baseRow = [
        cast.hash,
        cast.addedBy,
        new Date(cast.addedAt).toISOString(),
        cast.status
      ];
      
      if (config.includeMetadata) {
        baseRow.push(
          cast.metadata?.author || '',
          (cast.metadata?.content || '').replace(/"/g, '""'), // Escape quotes
          cast.metadata?.timestamp ? new Date(cast.metadata.timestamp).toISOString() : ''
        );
      }
      
      return baseRow;
    });
  
  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  return csvContent;
}

/**
 * Generate filename for CSV export
 */
export function generateExportFilename(): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return `base-chat-feed-casts-${dateStr}.csv`;
}

/**
 * Validate cast hash format
 */
export function isValidCastHash(hash: string): boolean {
  // Farcaster cast hashes are 40-character hex strings starting with 0x
  const hashRegex = /^0x[a-fA-F0-9]{40}$/;
  return hashRegex.test(hash);
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Truncate text for display
 */
export function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Clean and sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>"'&]/g, '') // Remove potentially harmful characters
    .substring(0, 1000); // Limit length
}

/**
 * Get Redis health status
 */
export async function getRedisHealth(): Promise<{ healthy: boolean; message: string }> {
  if (!redis) {
    return { healthy: false, message: 'Redis client not initialized' };
  }
  
  try {
    await redis.ping();
    return { healthy: true, message: 'Redis connection healthy' };
  } catch (error) {
    return { healthy: false, message: `Redis connection failed: ${error}` };
  }
}

/**
 * Initialize required Redis data structures
 */
export async function initializeRedisStructures(): Promise<void> {
  if (!redis) {
    console.warn('Redis not available for initialization');
    return;
  }
  
  try {
    // Ensure required sets exist
    const activeExists = await redis.exists('casts:active');
    if (!activeExists) {
      await redis.sadd('casts:active', 'placeholder');
      await redis.srem('casts:active', 'placeholder');
    }
    
    const allExists = await redis.exists('casts:all');
    if (!allExists) {
      await redis.sadd('casts:all', 'placeholder');
      await redis.srem('casts:all', 'placeholder');
    }
    
    console.log('Redis data structures initialized');
  } catch (error) {
    console.error('Failed to initialize Redis structures:', error);
  }
}
