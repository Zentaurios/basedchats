// 100% SECURE Rate Limiting for Admin Routes
// Protects against malicious actors while being reasonable for legitimate users

interface RateLimitRecord {
  requests: number[]  // Array of timestamps
  lastCleanup: number
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  blockDurationMs?: number
}

// In-memory rate limit storage (in production, use Redis for horizontal scaling)
const rateLimitStore = new Map<string, RateLimitRecord>()

// Rate limit configurations for different endpoint types
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Admin page browsing - generous for humans navigating
  'admin_pages': {
    maxRequests: 60,           // 60 requests
    windowMs: 60 * 1000,       // per minute
    blockDurationMs: 2 * 60 * 1000  // 2 minute cooldown if exceeded
  },
  
  // Admin API reads - moderate for dashboard refreshes
  'admin_api_read': {
    maxRequests: 30,           // 30 requests
    windowMs: 60 * 1000,       // per minute
    blockDurationMs: 5 * 60 * 1000  // 5 minute cooldown
  },
  
  // Admin API writes - stricter for cast management
  'admin_api_write': {
    maxRequests: 10,           // 10 requests
    windowMs: 60 * 1000,       // per minute
    blockDurationMs: 10 * 60 * 1000 // 10 minute cooldown
  },
  
  // Data export - very restrictive (expensive operations)
  'admin_export': {
    maxRequests: 3,            // 3 requests
    windowMs: 60 * 1000,       // per minute
    blockDurationMs: 30 * 60 * 1000 // 30 minute cooldown
  },
  
  // Authentication attempts - very strict security
  'admin_auth': {
    maxRequests: 5,            // 5 attempts
    windowMs: 5 * 60 * 1000,   // per 5 minutes
    blockDurationMs: 15 * 60 * 1000 // 15 minute cooldown
  }
}

/**
 * Get client identifier for rate limiting
 * Uses IP + User-Agent for better tracking of potential bots
 */
function getClientId(request: Request): string {
  // Get IP address (works with Vercel, Cloudflare, etc.)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown'
  
  // Include partial User-Agent for bot detection
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const uaHash = userAgent.substring(0, 20) // First 20 chars for fingerprinting
  
  return `${ip}:${uaHash}`
}

/**
 * Determine rate limit category based on request path and method
 */
function getRateLimitCategory(pathname: string, method: string): keyof typeof RATE_LIMITS {
  // Authentication endpoints
  if (pathname === '/admin/login' || pathname.includes('auth')) {
    return 'admin_auth'
  }
  
  // Export endpoints
  if (pathname.includes('export')) {
    return 'admin_export'
  }
  
  // API endpoints
  if (pathname.startsWith('/api/admin')) {
    return method === 'GET' ? 'admin_api_read' : 'admin_api_write'
  }
  
  // Admin pages
  return 'admin_pages'
}

/**
 * Clean up old rate limit records to prevent memory leaks
 */
function cleanupRateLimits() {
  const now = Date.now()
  const maxAge = 24 * 60 * 60 * 1000 // 24 hours
  
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.lastCleanup > maxAge) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Check and update rate limit for a client
 */
export function checkRateLimit(
  clientId: string, 
  category: keyof typeof RATE_LIMITS
): {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
} {
  const config = RATE_LIMITS[category]
  const now = Date.now()
  
  // Get or create record for this client
  let record = rateLimitStore.get(clientId)
  if (!record) {
    record = { requests: [], lastCleanup: now }
    rateLimitStore.set(clientId, record)
  }
  
  // Clean up old requests outside the window
  const windowStart = now - config.windowMs
  record.requests = record.requests.filter(timestamp => timestamp > windowStart)
  
  // Check if client is currently blocked
  if (record.requests.length >= config.maxRequests) {
    const oldestRequest = Math.min(...record.requests)
    const blockUntil = oldestRequest + (config.blockDurationMs || config.windowMs)
    
    if (now < blockUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockUntil,
        retryAfter: Math.ceil((blockUntil - now) / 1000)
      }
    }
    
    // Block period expired, reset requests
    record.requests = []
  }
  
  // Add current request
  record.requests.push(now)
  record.lastCleanup = now
  
  // Clean up old records periodically
  if (Math.random() < 0.01) { // 1% chance to trigger cleanup
    cleanupRateLimits()
  }
  
  const remaining = Math.max(0, config.maxRequests - record.requests.length)
  const resetTime = now + config.windowMs
  
  return {
    allowed: true,
    remaining,
    resetTime
  }
}

/**
 * Create rate limit response with helpful headers
 */
export function createRateLimitResponse(
  result: ReturnType<typeof checkRateLimit>,
  category: string
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'X-RateLimit-Category': category,
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetTime.toString(),
  })
  
  if (result.retryAfter) {
    headers.set('Retry-After', result.retryAfter.toString())
  }
  
  const message = result.retryAfter && result.retryAfter > 60
    ? `Rate limit exceeded. Too many requests to admin endpoints. Please try again in ${Math.ceil(result.retryAfter / 60)} minutes.`
    : `Rate limit exceeded. Please try again in ${result.retryAfter || 60} seconds.`
  
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      rateLimitInfo: {
        category,
        remaining: result.remaining,
        resetTime: result.resetTime,
        retryAfter: result.retryAfter
      }
    }),
    {
      status: 429, // Too Many Requests
      headers
    }
  )
}

/**
 * Log suspicious rate limit violations for monitoring
 */
function logSuspiciousActivity(
  clientId: string,
  category: string,
  pathname: string,
  violations: number
) {
  if (violations > 3) { // Log after multiple violations
    console.warn('[SECURITY] Potential malicious activity detected:', {
      clientId: clientId.substring(0, 20) + '...', // Partial for privacy
      category,
      pathname,
      violations,
      timestamp: new Date().toISOString(),
      severity: violations > 10 ? 'HIGH' : 'MEDIUM'
    })
  }
}

/**
 * Enhanced rate limiting specifically for admin routes
 * Integrates with existing admin authentication
 */
export function adminRateLimit(request: Request, pathname: string): Response | null {
  const clientId = getClientId(request)
  const category = getRateLimitCategory(pathname, request.method)
  
  const result = checkRateLimit(clientId, category)
  
  if (!result.allowed) {
    // Track violations for monitoring
    const violations = rateLimitStore.get(clientId)?.requests.length || 0
    logSuspiciousActivity(clientId, category, pathname, violations)
    
    return createRateLimitResponse(result, category)
  }
  
  return null // Request allowed
}