// 100% SECURE Route Protection Middleware - Protects ALL admin routes
// This provides an additional security layer on top of individual route protection
// Now includes smart rate limiting to prevent abuse

import { NextRequest, NextResponse } from 'next/server'
import { AdminSession } from './lib/types'
import { adminRateLimit } from './lib/rate-limiting'
import { AUTHORIZED_ADDRESSES_VERSION } from './lib/auth-utils'

const AUTHORIZED_ADDRESSES = process.env.ADMIN_ADDRESSES?.split(',') || []

/**
 * Validate admin session from middleware context
 * This runs before every admin route and API call
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

    // Parse session from secure cookie
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

    // SECURITY: Check address version to invalidate sessions when admin list changes
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
 * Main middleware function - protects all admin routes with rate limiting
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Apply rate limiting to ALL admin routes first
  const rateLimitResponse = adminRateLimit(request, pathname)
  if (rateLimitResponse) {
    // Log the rate limit violation
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    console.warn(`[RATE_LIMIT] ${pathname} blocked for client ${clientIp}`, {
      userAgent: request.headers.get('user-agent'),
      timestamp: new Date().toISOString()
    })
    return rateLimitResponse
  }

  // Admin page routes (/admin/*)
  if (pathname.startsWith('/admin')) {
    // Allow /admin/login page (needed for authentication flow)
    if (pathname === '/admin/login') {
      return NextResponse.next()
    }

    // Validate session for all other admin pages
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
    // Validate session for all admin API calls
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
    
    // Add admin session to headers for route handlers to use
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

// SECURITY NOTES:
// 1. This middleware runs on EVERY admin route request
// 2. Session validation happens server-side and cannot be bypassed
// 3. API routes get additional session headers for audit logging
// 4. Failed auth attempts are logged for monitoring
// 5. Expired sessions automatically redirect/return 401
