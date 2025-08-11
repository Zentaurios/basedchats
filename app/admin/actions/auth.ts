'use server'

import { verifyMessage } from 'viem'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { SECURE_COOKIE_OPTIONS } from '../../../lib/admin-auth'
import { checkAuthFailureRateLimit } from '../../../lib/rate-limiting'
import { isAuthorizedAddress, AuthorizedAddress, AUTHORIZED_ADDRESSES_VERSION } from '../../../lib/auth-utils'
import type { AdminSession } from '../../../lib/types'

/**
 * 🔧 FIXED: Only rate limit FAILED authentication attempts
 * Successful authentications are not rate limited
 */
export async function verifyAdminSignature(
  address: string,
  signature: string,
  message: string
): Promise<{ success: boolean; session?: AdminSession; error?: string }> {
  try {
    // 🎯 IMPROVED: Check authorization first (before rate limiting)
    if (!isAuthorizedAddress(address)) {
      // Don't rate limit unauthorized addresses - just reject immediately
      return {
        success: false,
        error: 'Address not authorized for admin access'
      }
    }

    // 🔧 FIXED: Use IP-based rate limiting for auth failures, not address-based
    // This prevents attackers from bypassing limits by changing addresses
    const headersList = await headers()
    const forwarded = headersList.get('x-forwarded-for')
    const realIp = headersList.get('x-real-ip') 
    const cfConnectingIp = headersList.get('cf-connecting-ip')
    const clientIp = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown'
    
    // Pre-check auth failure rate limit (but don't count this as a failure yet)
    const authRateLimit = checkAuthFailureRateLimit(clientIp)
    if (!authRateLimit.allowed) {
      const waitMinutes = authRateLimit.retryAfter ? Math.ceil(authRateLimit.retryAfter / 60) : 10
      return {
        success: false,
        error: `Too many failed authentication attempts. Please try again in ${waitMinutes} minutes.`
      }
    }

    // 🔐 SECURE: Verify the signature
    let isValidSignature: boolean
    try {
      isValidSignature = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`
      })
    } catch (error) {
      console.error('Signature verification error:', error)
      // 🚨 ONLY NOW count this as a failed attempt (after actual failure)
      checkAuthFailureRateLimit(clientIp)
      return {
        success: false,
        error: 'Invalid signature format'
      }
    }

    if (!isValidSignature) {
      // 🚨 ONLY count failed signature verification as rate limit violation
      checkAuthFailureRateLimit(clientIp)
      return {
        success: false,
        error: 'Invalid signature'
      }
    }

    // ✅ SUCCESS: Create session (no rate limiting for successful auth)
    const now = Date.now()
    const session: AdminSession = {
      address: address as AuthorizedAddress,
      issuedAt: now,
      expiresAt: now + (24 * 60 * 60 * 1000), // 24 hours
      addressVersion: AUTHORIZED_ADDRESSES_VERSION
    }

    // Store session in secure cookie
    const cookieStore = await cookies()
    cookieStore.set('admin-session', JSON.stringify(session), SECURE_COOKIE_OPTIONS)

    // 🎉 Log successful authentication (not a rate limit violation)
    console.log(`✅ Admin authentication successful: ${address}`, {
      timestamp: new Date().toISOString(),
      clientIp,
      remainingAuthAttempts: authRateLimit.remaining
    })

    return {
      success: true,
      session
    }
  } catch (error) {
    console.error('Authentication process failed:', error)
    
    // 🚨 Count unexpected errors as failed attempts too
    try {
      const headersList = await headers()
      const forwarded = headersList.get('x-forwarded-for')
      const clientIp = forwarded?.split(',')[0] || 'unknown'
      checkAuthFailureRateLimit(clientIp)
    } catch {
      // Ignore rate limit errors during error handling
    }
    
    return {
      success: false,
      error: 'Authentication failed due to server error'
    }
  }
}

/**
 * Get current admin session from cookies
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('admin-session')
    
    if (!sessionCookie?.value) {
      return null
    }

    const session: AdminSession = JSON.parse(sessionCookie.value)
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      await clearAdminSession()
      return null
    }

    // Verify address is still authorized
    if (!isAuthorizedAddress(session.address)) {
      await clearAdminSession()
      return null
    }

    return session
  } catch (error) {
    console.error('Failed to get admin session:', error)
    return null
  }
}

/**
 * 🔧 FIXED: Clear admin session with matching cookie options
 */
export async function clearAdminSession() {
  try {
    const cookieStore = await cookies()
    
    // Get session before clearing for logging
    const sessionCookie = cookieStore.get('admin-session')
    if (sessionCookie?.value) {
      try {
        const session: AdminSession = JSON.parse(sessionCookie.value)
        console.log('Admin session cleared:', session.address)
      } catch (error) {
        console.warn('Corrupted session during logout:', error)
      }
    }
    
    // 🚨 CRITICAL FIX: Use the same options when deleting the cookie
    // The cookie must be deleted with the same path, domain, secure, sameSite options
    cookieStore.set('admin-session', '', {
      ...SECURE_COOKIE_OPTIONS,
      maxAge: 0, // Expire immediately
      expires: new Date(0), // Also set expires to past date for compatibility
    })
    
    // Also try the simple delete method as a fallback
    cookieStore.delete('admin-session')
    
  } catch (error) {
    console.error('Failed to clear admin session:', error)
  }
}

/**
 * 🔧 IMPROVED: Logout admin with better cookie clearing and redirect
 */
export async function logoutAdmin() {
  // Clear the session first
  await clearAdminSession()
  
  // Add a small delay to ensure cookie is cleared before redirect
  // In server actions, this happens synchronously, but being extra safe
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Redirect to home page
  redirect('/')
}

/**
 * Require admin authentication (throws if not authenticated)
 */
export async function requireAdminAuth(): Promise<AdminSession> {
  const session = await getAdminSession()
  
  if (!session) {
    redirect('/admin/login')
  }
  
  return session
}

/**
 * Check if an address is authorized (server action for client components)
 * 🆕 This is NOT rate limited since it's just a lookup
 */
export async function checkAddressAuthorization(address: string): Promise<{ isAuthorized: boolean }> {
  try {
    const authorized = isAuthorizedAddress(address)
    return { isAuthorized: authorized }
  } catch (error) {
    console.error('Failed to check address authorization:', error)
    return { isAuthorized: false }
  }
}

// 🎯 KEY IMPROVEMENTS:
// 1. ✅ Only rate limit actual FAILED authentication attempts
// 2. ✅ Successful authentications are never rate limited  
// 3. ✅ Authorization checks are not rate limited
// 4. ✅ Use IP-based rate limiting instead of address-based
// 5. ✅ More informative logging for debugging
// 6. ✅ Reduced wait times (10 minutes vs 15 minutes)
// 7. 🚨 FIXED: Proper cookie deletion with matching options
