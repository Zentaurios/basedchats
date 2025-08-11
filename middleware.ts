// 🔧 FIXED: Route Protection Middleware - Human-Friendly Rate Limiting
// Separates page access from authentication failures
// Much more reasonable limits for normal human behavior

import { NextRequest, NextResponse } from 'next/server'
import { AdminSession } from './lib/types'
import { adminRateLimit } from './lib/rate-limiting'
import { AUTHORIZED_ADDRESSES_VERSION } from './lib/auth-utils'

const AUTHORIZED_ADDRESSES = process.env.ADMIN_ADDRESSES?.split(',') || []

/**
 * Validate admin session from middleware context
 */
function validateAdminSessionMiddleware(request: NextRequest): {
  isValid: boolean
  session?: AdminSession
  error?: string
} {
  try {
    const sessionCookie = request.cookies.get('admin-session')
    
    if (!sessionCookie?.value) {
      return {
        isValid: false,
        error: 'No admin session found'
      }
    }

    let session: AdminSession
    try {
      session = JSON.parse(sessionCookie.value)
    } catch {
      return {
        isValid: false,
        error: 'Invalid session format'
      }
    }

    // Validate session structure
    if (!session.address || !session.expiresAt || !session.issuedAt) {
      return {
        isValid: false,
        error: 'Malformed session data'
      }
    }

    // Check address version to invalidate sessions when admin list changes
    if (!session.addressVersion || session.addressVersion !== AUTHORIZED_ADDRESSES_VERSION) {
      return {
        isValid: false,
        error: 'Session invalidated due to security update'
      }
    }

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      return {
        isValid: false,
        error: 'Session expired'
      }
    }

    // Verify address is still in authorized list
    const normalizedAddress = session.address.toLowerCase()
    const isAuthorized = AUTHORIZED_ADDRESSES.some(
      authAddr => authAddr.toLowerCase() === normalizedAddress
    )
    
    if (!isAuthorized) {
      return {
        isValid: false,
        error: 'Address no longer authorized'
      }
    }

    return {
      isValid: true,
      session
    }
  } catch (error) {
    console.error('Middleware session validation error:', error)
    return {
      isValid: false,
      error: 'Session validation failed'
    }
  }
}

/**
 * 🔧 FIXED: Main middleware function with human-friendly rate limiting
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 🎯 IMPROVED: Apply reasonable rate limiting to admin routes
  const rateLimitResponse = adminRateLimit(request, pathname)
  if (rateLimitResponse) {
    // 🔇 REDUCED: Only log actual violations, not normal rate limits
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    
    // Only log if it's a significant violation
    if (rateLimitResponse.status === 429) {
      const rateLimitCategory = rateLimitResponse.headers.get('X-RateLimit-Category')
      if (rateLimitCategory === 'admin_auth_failures') {
        console.warn(`[RATE_LIMIT] Authentication failure rate limit for ${clientIp}`, {
          pathname,
          category: rateLimitCategory,
          timestamp: new Date().toISOString()
        })
      }
    }
    
    return rateLimitResponse
  }

  // Admin page routes (/admin/*)
  if (pathname.startsWith('/admin')) {
    // 🆕 IMPROVED: Allow /admin/login page with generous rate limiting
    if (pathname === '/admin/login') {
      // Login page access already rate limited above with generous limits
      return NextResponse.next()
    }

    // 🔐 SECURE: Validate session for all other admin pages
    const authResult = validateAdminSessionMiddleware(request)
    
    if (!authResult.isValid) {
      // Redirect to admin login page
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
  }

  // Admin API routes (/api/admin/*)
  if (pathname.startsWith('/api/admin')) {
    // 🔐 SECURE: Validate session for all admin API calls
    const authResult = validateAdminSessionMiddleware(request)
    
    if (!authResult.isValid) {
      // Return 401 Unauthorized for API calls
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Unauthorized',
          code: 'ADMIN_AUTH_REQUIRED'
        },
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'WWW-Authenticate': 'Wallet signature required'
          }
        }
      )
    }
    
    // Add admin session to headers for route handlers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-admin-session', JSON.stringify(authResult.session))
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  return NextResponse.next()
}

/**
 * Configure which routes this middleware protects
 */
export const config = {
  matcher: [
    '/admin/:path*',    // All admin pages
    '/api/admin/:path*' // All admin API routes
  ]
}

// 🎯 IMPROVEMENTS MADE:
// 1. ✅ Separated login page access from authentication attempts  
// 2. ✅ Much more generous rate limits for normal human behavior
// 3. ✅ Reduced logging noise - only log actual security violations
// 4. ✅ Shorter cooldown periods for better user experience
// 5. ✅ Authentication failures now tracked separately with own limits
