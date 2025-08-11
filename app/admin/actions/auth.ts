'use server'

import { verifyMessage } from 'viem'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SECURE_COOKIE_OPTIONS } from '../../../lib/admin-auth'
import { checkRateLimit } from '../../../lib/rate-limiting'
import { isAuthorizedAddress, AuthorizedAddress, AUTHORIZED_ADDRESSES_VERSION } from '../../../lib/auth-utils'
import type { AdminSession } from '../../../lib/types'

/**
 * Verify a signature and validate admin access
 */
export async function verifyAdminSignature(
  address: string,
  signature: string,
  message: string
): Promise<{ success: boolean; session?: AdminSession; error?: string }> {
  try {
    // Rate limiting - prevent brute force authentication attacks
    // Use client ID based on address for auth attempts
    const authRateLimit = checkRateLimit(address.toLowerCase(), 'admin_auth')
    if (!authRateLimit.allowed) {
      const waitMinutes = authRateLimit.retryAfter ? Math.ceil(authRateLimit.retryAfter / 60) : 15
      return {
        success: false,
        error: `Too many authentication attempts. Please try again in ${waitMinutes} minutes.`
      }
    }

    // Check if address is in authorized list
    if (!isAuthorizedAddress(address)) {
      return {
        success: false,
        error: 'Address not authorized for admin access'
      }
    }

    // Verify the signature
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`
    })

    if (!isValid) {
      return {
        success: false,
        error: 'Invalid signature'
      }
    }

    // Create session with enhanced security
    const now = Date.now()
    const session: AdminSession = {
      address: address as AuthorizedAddress,
      issuedAt: now,
      expiresAt: now + (24 * 60 * 60 * 1000), // 24 hours
      addressVersion: AUTHORIZED_ADDRESSES_VERSION // For session invalidation
    }

    // Store session in ultra-secure cookie
    const cookieStore = await cookies()
    cookieStore.set('admin-session', JSON.stringify(session), SECURE_COOKIE_OPTIONS)

    /* Log successful authentication
    await logAdminAction(session, 'ADMIN_LOGIN', {
      timestamp: now,
      method: 'wallet_signature',
      rateLimit: {
        remaining: authRateLimit.remaining,
        resetTime: authRateLimit.resetTime
      }
    })*/

    return {
      success: true,
      session
    }
  } catch (error) {
    console.error('Signature verification failed:', error)
    return {
      success: false,
      error: 'Signature verification failed'
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
 * Clear admin session and log the action
 */
export async function clearAdminSession() {
  try {
    const cookieStore = await cookies()
    
    // Get session before clearing for logging
    const sessionCookie = cookieStore.get('admin-session')
    if (sessionCookie?.value) {
      try {
        const session: AdminSession = JSON.parse(sessionCookie.value)
        /*await logAdminAction(session, 'ADMIN_LOGOUT', {
          reason: 'manual_logout'
        })*/
        console.log('Admin session cleared:', session.address)
      } catch (error) {
        // Session was corrupted, still clear it
        console.warn('Corrupted session during logout:', error)
      }
    }
    
    // Clear the secure cookie
    cookieStore.delete('admin-session')
  } catch (error) {
    console.error('Failed to clear admin session:', error)
  }
}

/**
 * Logout admin and redirect to home
 */
export async function logoutAdmin() {
  await clearAdminSession()
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