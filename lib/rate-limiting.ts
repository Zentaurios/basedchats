// 🔧 FIXED: Human-Friendly Rate Limiting for Admin Routes
// Separates page access from authentication attempts
// Only rate limits actual FAILED authentication attempts

interface RateLimitRecord {
  requests: number[]  // Array of timestamps
  lastCleanup: number
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  blockDurationMs?: number
}

// In-memory rate limit storage (use Redis in production for scaling)
const rateLimitStore = new Map<string, RateLimitRecord>()

// 🎯 IMPROVED: More reasonable rate limits for different endpoint types
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Admin page browsing - very generous for humans navigating
  'admin_pages': {
    maxRequests: 120,          // 120 requests  
    windowMs: 60 * 1000,       // per minute (2 per second average)
    blockDurationMs: 1 * 60 * 1000  // 1 minute cooldown
  },
  
  // Admin API reads - generous for dashboard refreshes
  'admin_api_read': {
    maxRequests: 60,           // 60 requests
    windowMs: 60 * 1000,       // per minute  
    blockDurationMs: 2 * 60 * 1000  // 2 minute cooldown
  },
  
  // Admin API writes - moderate for content management
  'admin_api_write': {
    maxRequests: 30,           // 30 requests
    windowMs: 60 * 1000,       // per minute
    blockDurationMs: 5 * 60 * 1000  // 5 minute cooldown
  },
  
  // Data export - restrictive (expensive operations)
  'admin_export': {
    maxRequests: 5,            // 5 requests
    windowMs: 60 * 1000,       // per minute
    blockDurationMs: 10 * 60 * 1000 // 10 minute cooldown
  },
  
  // 🚨 FIXED: Only FAILED authentication attempts (not page visits!)
  'admin_auth_failures': {
    maxRequests: 10,           // 10 failed attempts (much more generous)
    windowMs: 15 * 60 * 1000,  // per 15 minutes (longer window)
    blockDurationMs: 10 * 60 * 1000 // 10 minute cooldown (shorter penalty)
  },

  // 🆕 NEW: Separate category for page access (very generous)
  'admin_login_access': {
    maxRequests: 50,           // 50 page visits
    windowMs: 60 * 1000,       // per minute
    blockDurationMs: 2 * 60 * 1000  // 2 minute cooldown
  }
}

/**
 * Get client identifier for rate limiting
 * Uses IP + User-Agent for better tracking
 */
function getClientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const uaHash = userAgent.substring(0, 20)
  
  return `${ip}:${uaHash}`
}

/**
 * 🎯 IMPROVED: Better categorization of requests
 */
function getRateLimitCategory(pathname: string, method: string): keyof typeof RATE_LIMITS {
  // 🆕 FIXED: Login page access gets its own generous category
  if (pathname === '/admin/login' && method === 'GET') {
    return 'admin_login_access'
  }
  
  // Export endpoints
  if (pathname.includes('export')) {
    return 'admin_export'
  }
  
  // API endpoints
  if (pathname.startsWith('/api/admin')) {
    return method === 'GET' ? 'admin_api_read' : 'admin_api_write'
  }
  
  // Other admin pages (dashboard, etc.)
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
  
  // Periodic cleanup
  if (Math.random() < 0.01) {
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
 * 🆕 NEW: Specific rate limiting for authentication failures only
 */
export function checkAuthFailureRateLimit(clientId: string): {
  allowed: boolean
  remaining: number
  retryAfter?: number
} {
  const result = checkRateLimit(clientId, 'admin_auth_failures')
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    retryAfter: result.retryAfter
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
  
  // 🎯 IMPROVED: More helpful error messages
  let message: string
  if (category === 'admin_auth_failures') {
    message = result.retryAfter && result.retryAfter > 60
      ? `Too many failed login attempts. Please try again in ${Math.ceil(result.retryAfter / 60)} minutes.`
      : `Too many failed login attempts. Please try again in ${result.retryAfter || 60} seconds.`
  } else {
    message = result.retryAfter && result.retryAfter > 60
      ? `Rate limit exceeded. Please try again in ${Math.ceil(result.retryAfter / 60)} minutes.`
      : `Rate limit exceeded. Please try again in ${result.retryAfter || 60} seconds.`
  }
  
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
      status: 429,
      headers
    }
  )
}

/**
 * 🎯 IMPROVED: Only log truly suspicious activity (much higher threshold)
 */
function logSuspiciousActivity(
  clientId: string,
  category: string,
  pathname: string,
  violations: number
) {
  // 🚨 FIXED: Only log after many more violations to reduce noise
  let shouldLog = false
  let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW'

  if (category === 'admin_auth_failures' && violations > 8) {
    shouldLog = true
    severity = violations > 15 ? 'HIGH' : 'MEDIUM'
  } else if (category !== 'admin_auth_failures' && violations > 20) {
    shouldLog = true  
    severity = violations > 50 ? 'HIGH' : 'MEDIUM'
  }

  if (shouldLog) {
    console.warn('[SECURITY] Potential malicious activity detected:', {
      clientId: clientId.substring(0, 20) + '...', 
      category,
      pathname,
      violations,
      timestamp: new Date().toISOString(),
      severity
    })
  }
}

/**
 * 🔧 FIXED: Enhanced admin rate limiting with proper categorization
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
