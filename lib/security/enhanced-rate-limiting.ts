// Enhanced Rate Limiting with Redis Support
// Provides persistent rate limiting across server restarts and horizontal scaling

import { redis } from '../redis'

interface RateLimitRecord {
  requests: number[]  // Array of timestamps
  lastCleanup: number
  blockedUntil?: number // For temporary blocks
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  blockDurationMs?: number
  description: string // For logging/monitoring
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
  category: string
}

// Enhanced rate limit configurations
const ENHANCED_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Admin page browsing - generous for legitimate use
  'admin_pages': {
    maxRequests: 60,
    windowMs: 60 * 1000,
    blockDurationMs: 2 * 60 * 1000,
    description: 'Admin page navigation'
  },
  
  // Admin API reads - moderate for dashboard refreshes
  'admin_api_read': {
    maxRequests: 30,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
    description: 'Admin API read operations'
  },
  
  // Admin API writes - stricter for sensitive operations
  'admin_api_write': {
    maxRequests: 10,
    windowMs: 60 * 1000,
    blockDurationMs: 10 * 60 * 1000,
    description: 'Admin API write operations'
  },
  
  // Data export - very restrictive (expensive operations)
  'admin_export': {
    maxRequests: 3,
    windowMs: 60 * 1000,
    blockDurationMs: 30 * 60 * 1000,
    description: 'Data export operations'
  },
  
  // Authentication attempts - very strict security
  'admin_auth': {
    maxRequests: 5,
    windowMs: 5 * 60 * 1000,
    blockDurationMs: 15 * 60 * 1000,
    description: 'Authentication attempts'
  },
  
  // Notification sending - prevent spam
  'admin_notify': {
    maxRequests: 20,
    windowMs: 60 * 1000,
    blockDurationMs: 10 * 60 * 1000,
    description: 'Notification sending'
  }
}

// In-memory fallback storage
const memoryStore = new Map<string, RateLimitRecord>()

/**
 * Get Redis client or fallback to memory
 */
function getStorageClient() {
  if (redis) {
    return {
      type: 'redis' as const,
      client: redis
    }
  } else {
    return {
      type: 'memory' as const,
      client: null
    }
  }
}

/**
 * Get rate limit record from storage
 */
async function getRateLimitRecord(key: string): Promise<RateLimitRecord | null> {
  const storage = getStorageClient()
  
  if (storage.type === 'redis' && storage.client) {
    try {
      const data = await storage.client.get(`rate_limit:${key}`)
      return data ? JSON.parse(data as string) : null
    } catch (error) {
      console.error('Redis get error:', error)
      return memoryStore.get(key) || null
    }
  }
  
  return memoryStore.get(key) || null
}

/**
 * Set rate limit record in storage
 */
async function setRateLimitRecord(key: string, record: RateLimitRecord): Promise<void> {
  const storage = getStorageClient()
  
  if (storage.type === 'redis' && storage.client) {
    try {
      // Set with TTL to auto-cleanup old records
      await storage.client.setex(`rate_limit:${key}`, 86400, JSON.stringify(record)) // 24 hour TTL
    } catch (error) {
      console.error('Redis set error:', error)
      memoryStore.set(key, record) // Fallback to memory
    }
  } else {
    memoryStore.set(key, record)
  }
}

/**
 * Get enhanced client identifier for rate limiting
 */
function getEnhancedClientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown'
  
  // Enhanced fingerprinting for better bot detection
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const acceptLanguage = request.headers.get('accept-language') || 'unknown'
  
  // Create a more unique identifier
  const fingerprint = Buffer.from(
    `${ip}:${userAgent.substring(0, 50)}:${acceptLanguage.substring(0, 20)}`
  ).toString('base64').substring(0, 32)
  
  return fingerprint
}

/**
 * Determine enhanced rate limit category
 */
function getEnhancedRateLimitCategory(pathname: string, method: string): keyof typeof ENHANCED_RATE_LIMITS {
  // Authentication endpoints
  if (pathname === '/admin/login' || pathname.includes('auth')) {
    return 'admin_auth'
  }
  
  // Export endpoints
  if (pathname.includes('export')) {
    return 'admin_export'
  }
  
  // Notification endpoints
  if (pathname.includes('notify')) {
    return 'admin_notify'
  }
  
  // API endpoints
  if (pathname.startsWith('/api/admin')) {
    return method === 'GET' ? 'admin_api_read' : 'admin_api_write'
  }
  
  // Admin pages
  return 'admin_pages'
}

/**
 * Enhanced rate limiting with Redis persistence
 */
export async function enhancedRateLimit(
  request: Request, 
  pathname: string
): Promise<RateLimitResult | null> {
  const clientId = getEnhancedClientId(request)
  const category = getEnhancedRateLimitCategory(pathname, request.method)
  const config = ENHANCED_RATE_LIMITS[category]
  const now = Date.now()
  
  // Create storage key
  const storageKey = `${clientId}:${category}`
  
  // Get or create record
  let record = await getRateLimitRecord(storageKey)
  if (!record) {
    record = { requests: [], lastCleanup: now }
  }
  
  // Check if client is currently blocked
  if (record.blockedUntil && now < record.blockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.blockedUntil,
      retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
      category
    }
  }
  
  // Clean up old requests outside the window
  const windowStart = now - config.windowMs
  record.requests = record.requests.filter(timestamp => timestamp > windowStart)
  
  // Check if limit exceeded
  if (record.requests.length >= config.maxRequests) {
    // Set block period
    record.blockedUntil = now + (config.blockDurationMs || config.windowMs)
    
    // Log security violation
    console.warn('[SECURITY] Rate limit exceeded:', {
      clientId: clientId.substring(0, 16) + '...', // Partial for privacy
      category,
      description: config.description,
      requests: record.requests.length,
      maxRequests: config.maxRequests,
      blockedUntil: new Date(record.blockedUntil).toISOString(),
      pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent')?.substring(0, 100)
    })
    
    await setRateLimitRecord(storageKey, record)
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.blockedUntil,
      retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
      category
    }
  }
  
  // Add current request
  record.requests.push(now)
  record.lastCleanup = now
  
  // Store updated record
  await setRateLimitRecord(storageKey, record)
  
  const remaining = Math.max(0, config.maxRequests - record.requests.length)
  const resetTime = now + config.windowMs
  
  return {
    allowed: true,
    remaining,
    resetTime,
    category
  }
}

/**
 * Create enhanced rate limit response
 */
export function createEnhancedRateLimitResponse(
  result: RateLimitResult
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'X-RateLimit-Category': result.category,
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetTime.toString(),
  })
  
  if (result.retryAfter) {
    headers.set('Retry-After', result.retryAfter.toString())
  }
  
  const config = ENHANCED_RATE_LIMITS[result.category]
  const message = result.retryAfter && result.retryAfter > 60
    ? `Rate limit exceeded for ${config.description}. Please try again in ${Math.ceil(result.retryAfter / 60)} minutes.`
    : `Rate limit exceeded for ${config.description}. Please try again in ${result.retryAfter || 60} seconds.`
  
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      rateLimitInfo: {
        category: result.category,
        description: config.description,
        remaining: result.remaining,
        resetTime: result.resetTime,
        retryAfter: result.retryAfter
      }
    }),
    {
      status: 429,
      headers
    }
  )
}

/**
 * Enhanced admin rate limiting middleware
 */
export async function enhancedAdminRateLimit(
  request: Request, 
  pathname: string
): Promise<Response | null> {
  const result = await enhancedRateLimit(request, pathname)
  
  if (result && !result.allowed) {
    return createEnhancedRateLimitResponse(result)
  }
  
  return null // Request allowed
}

/**
 * Check rate limit without incrementing (for preview)
 */
export async function checkRateLimitStatus(
  clientId: string,
  category: keyof typeof ENHANCED_RATE_LIMITS
): Promise<RateLimitResult> {
  const config = ENHANCED_RATE_LIMITS[category]
  const now = Date.now()
  
  const record = await getRateLimitRecord(`${clientId}:${category}`)
  
  if (!record) {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
      category
    }
  }
  
  if (record.blockedUntil && now < record.blockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.blockedUntil,
      retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
      category
    }
  }
  
  const windowStart = now - config.windowMs
  const activeRequests = record.requests.filter(timestamp => timestamp > windowStart)
  const remaining = Math.max(0, config.maxRequests - activeRequests.length)
  
  return {
    allowed: remaining > 0,
    remaining,
    resetTime: now + config.windowMs,
    category
  }
}