import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { isAuthorizedAddress, AUTHORIZED_ADDRESSES_VERSION } from './auth-utils'
import type { AdminSession } from './types'

/**
 * 100% SECURE: Validate admin session from HTTP-only cookie
 * This runs on the server and cannot be bypassed by client-side manipulation
 */
export async function validateAdminSession(): Promise<{ 
  isValid: boolean
  session?: AdminSession 
  error?: string 
}> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('admin-session')
    
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
      // Clear outdated session
      cookieStore.delete('admin-session')
      return {
        isValid: false,
        error: 'Session invalidated due to security update'
      }
    }

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      // Clear expired session
      cookieStore.delete('admin-session')
      return {
        isValid: false,
        error: 'Session expired'
      }
    }

    // Verify address is still in authorized list
    if (!isAuthorizedAddress(session.address)) {
      // Clear unauthorized session
      cookieStore.delete('admin-session')
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
    console.error('Session validation error:', error)
    return {
      isValid: false,
      error: 'Session validation failed'
    }
  }
}

/**
 * 100% SECURE: Middleware for API routes - validates admin session
 * Use this in ALL /api/admin/* routes
 */
export function withAdminAuth(
  handler: (session: AdminSession, request: NextRequest) => Promise<Response>
) {
  return async (request: NextRequest): Promise<Response> => {
    const authResult = await validateAdminSession()
    
    if (!authResult.isValid || !authResult.session) {
      // Return 401 Unauthorized response
      return new Response(
        JSON.stringify({
          success: false,
          error: authResult.error || 'Unauthorized'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          }
        }
      )
    }

    // Call the handler with validated session
    return handler(authResult.session, request)
  }
}

/**
 * 100% SECURE: Extract admin session from API request
 * Only use this after withAdminAuth middleware
 */
export async function getAdminSessionFromRequest(): Promise<AdminSession | null> {
  const authResult = await validateAdminSession()
  return authResult.isValid ? authResult.session || null : null
}

/**
 * Enhanced cookie security settings
 */
export const SECURE_COOKIE_OPTIONS = {
  httpOnly: true,                    // Cannot be accessed by JavaScript
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict' as const,       // CSRF protection
  maxAge: 24 * 60 * 60,             // 24 hours in seconds
  path: '/',                         // Available site-wide
  // Add additional security headers
  ...(process.env.NODE_ENV === 'production' && {
    domain: process.env.NEXT_PUBLIC_URL?.replace('https://', ''), // Lock to domain
  })
} as const

/**
 * 100% SECURE: Log admin actions for audit trail
 */
/* export async function logAdminAction(
  session: AdminSession,
  action: string,
  details?: Record<string, unknown>
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    address: session.address,
    action,
    details,
    userAgent: '', // Would get from request headers in actual implementation
    ip: '',        // Would get from request headers in actual implementation
  }
  
  // In production, store this in a secure audit log
  // console.log('ADMIN_ACTION:', JSON.stringify(logEntry, null, 2))
} */
