/**
 * Authentication utility functions
 * These are utility functions that don't need to be server actions
 */

// Get authorized admin addresses from environment variables
function getAuthorizedAddresses(): string[] {
  const addresses = process.env.ADMIN_ADDRESSES
  if (!addresses) {
    throw new Error('ADMIN_ADDRESSES environment variable is not set')
  }
  return addresses.split(',').map(addr => addr.trim())
}

// SECURITY: Get version from environment to invalidate sessions when admin list changes
export const AUTHORIZED_ADDRESSES_VERSION = process.env.ADMIN_ADDRESSES_VERSION || "v1.0"

export type AuthorizedAddress = string

/**
 * Generate authentication message for signing
 */
export function generateAuthMessage(address: string): string {
  const timestamp = Date.now()
  return `Sign this message to authenticate as admin for BasedChats app.\n\nAddress: ${address}\nTimestamp: ${timestamp}\nNonce: ${Math.random().toString(36).substring(7)}`
}

/**
 * Check if address is authorized (utility function)
 */
export function isAuthorizedAddress(address: string): boolean {
  const normalizedAddress = address.toLowerCase()
  const authorizedAddresses = getAuthorizedAddresses()
  return authorizedAddresses.some(
    authAddr => authAddr.toLowerCase() === normalizedAddress
  )
}
