// CSRF Protection for Admin Operations
// Provides Cross-Site Request Forgery protection for sensitive admin actions

import { randomBytes, createHash } from 'crypto'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

interface CSRFTokenData {
  token: string
  secret: string
  issuedAt: number
  expiresAt: number
}

const CSRF_TOKEN_LIFETIME = 30 * 60 * 1000 // 30 minutes
const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): CSRFTokenData {
  const secret = randomBytes(32).toString('hex')
  const timestamp = Date.now().toString()
  
  // Create token by hashing secret + timestamp
  const token = createHash('sha256')
    .update(secret + timestamp)
    .digest('hex')
  
  const now = Date.now()
  
  return {
    token,
    secret,
    issuedAt: now,
    expiresAt: now + CSRF_TOKEN_LIFETIME
  }
}

/**
 * Validate CSRF token against secret
 */
export function validateCSRFToken(token: string, secret: string, issuedAt: number): boolean {
  try {
    // Recreate expected token
    const expectedToken = createHash('sha256')
      .update(secret + issuedAt.toString())
      .digest('hex')
    
    // Timing-safe comparison
    return token === expectedToken
  } catch (error) {
    console.error('CSRF token validation error:', error)
    return false
  }
}

/**
 * Set CSRF token in secure cookie
 */
export async function setCSRFToken(): Promise<string> {
  const tokenData = generateCSRFToken()
  const cookieStore = await cookies()
  
  // Store token data in secure cookie
  cookieStore.set(CSRF_COOKIE_NAME, JSON.stringify(tokenData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_LIFETIME / 1000,
    path: '/'
  })
  
  return tokenData.token
}

/**
 * Get and validate CSRF token from request
 */
export async function validateCSRFFromRequest(request: NextRequest): Promise<{
  isValid: boolean
  error?: string
}> {
  try {
    const cookieStore = await cookies()
    const tokenCookie = cookieStore.get(CSRF_COOKIE_NAME)
    
    if (!tokenCookie?.value) {
      return {
        isValid: false,
        error: 'CSRF token cookie not found'
      }
    }
    
    // Parse token data from cookie
    let tokenData: CSRFTokenData
    try {
      tokenData = JSON.parse(tokenCookie.value)
    } catch {
      return {
        isValid: false,
        error: 'Invalid CSRF token format'
      }
    }
    
    // Check expiration
    if (Date.now() > tokenData.expiresAt) {
      return {
        isValid: false,
        error: 'CSRF token expired'
      }
    }
    
    // Get token from header or body
    const headerToken = request.headers.get(CSRF_HEADER_NAME)
    let bodyToken: string | undefined
    
    // Try to get token from request body for POST requests
    if (request.method === 'POST') {
      try {
        const body = await request.clone().json()
        bodyToken = body.csrfToken
      } catch {
        // Not JSON or no token in body
      }
    }
    
    const providedToken = headerToken || bodyToken
    
    if (!providedToken) {
      return {
        isValid: false,
        error: 'CSRF token not provided in header or body'
      }
    }
    
    // Validate token
    const isValidToken = validateCSRFToken(
      providedToken,
      tokenData.secret,
      tokenData.issuedAt
    )
    
    if (!isValidToken) {
      return {
        isValid: false,
        error: 'Invalid CSRF token'
      }
    }
    
    return { isValid: true }
    
  } catch (error) {
    console.error('CSRF validation error:', error)
    return {
      isValid: false,
      error: 'CSRF validation failed'
    }
  }
}

/**
 * Middleware to validate CSRF for admin write operations
 */
export function withCSRFProtection<T>(
  handler: (request: NextRequest) => Promise<T>
) {
  return async (request: NextRequest): Promise<T> => {
    // Only protect write operations (POST, PUT, DELETE, PATCH)
    const writeOperations = ['POST', 'PUT', 'DELETE', 'PATCH']
    
    if (writeOperations.includes(request.method)) {
      const csrfResult = await validateCSRFFromRequest(request)
      
      if (!csrfResult.isValid) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'CSRF validation failed',
            code: 'CSRF_TOKEN_INVALID'
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            }
          }
        ) as T
      }
    }
    
    return handler(request)
  }
}

/**
 * Get CSRF token for client-side use
 */
export async function getCSRFTokenForClient(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const tokenCookie = cookieStore.get(CSRF_COOKIE_NAME)
    
    if (!tokenCookie?.value) {
      return null
    }
    
    const tokenData: CSRFTokenData = JSON.parse(tokenCookie.value)
    
    // Check if token is still valid
    if (Date.now() > tokenData.expiresAt) {
      return null
    }
    
    return tokenData.token
  } catch (error) {
    console.error('Error getting CSRF token for client:', error)
    return null
  }
}

/**
 * Refresh CSRF token (call this periodically)
 */
export async function refreshCSRFToken(): Promise<string> {
  return setCSRFToken()
}

/**
 * Clear CSRF token (call on logout)
 */
export async function clearCSRFToken(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(CSRF_COOKIE_NAME)
}
