# Security Module

This directory contains enhanced security features for the BasedChats app admin system.

## Files

- `enhanced-rate-limiting.ts` - Redis-based rate limiting with fallback to memory
- `csrf-protection.ts` - CSRF token generation and validation 
- `input-sanitization.ts` - Comprehensive input sanitization and validation

## Installation

To get the full security features, install the required dependency:

```bash
npm install isomorphic-dompurify @types/dompurify
```

The input sanitization module will work with basic HTML encoding if DOMPurify is not available, but for maximum security, install the dependency.

## Usage

### Input Sanitization
```typescript
import { sanitizeAndValidateCastHash, sanitizeTextInput } from '../lib/security/input-sanitization'

// Validate cast hash
const result = sanitizeAndValidateCastHash(userInput)
if (!result.isValid) {
  return { error: result.error }
}

// Sanitize text input
const clean = sanitizeTextInput(userInput)
```

### Enhanced Rate Limiting
```typescript
import { enhancedAdminRateLimit } from '../lib/security/enhanced-rate-limiting'

// In middleware or API routes
const rateLimitResponse = await enhancedAdminRateLimit(request, pathname)
if (rateLimitResponse) {
  return rateLimitResponse // Rate limit exceeded
}
```

### CSRF Protection
```typescript
import { withCSRFProtection } from '../lib/security/csrf-protection'

// Wrap API handlers
export const POST = withCSRFProtection(async (request) => {
  // Your handler logic here
})
```

## Features

### Input Sanitization
- XSS protection using DOMPurify
- Cast hash validation (0x + 40 hex chars)
- FID validation (1-1,000,000)
- URL validation (HTTPS only in production)
- Request body sanitization
- Security event logging

### Rate Limiting
- Redis-based persistence (with memory fallback)
- Category-specific limits
- Enhanced client fingerprinting
- Graduated penalties
- Automatic cleanup

### CSRF Protection
- Cryptographically secure tokens
- HTTP-only cookie storage
- Automatic expiration (30 minutes)
- Write operation protection
- Timing-safe validation

## Security Levels

The security features are designed to work in layers:

1. **Basic**: Works without dependencies (HTML encoding only)
2. **Enhanced**: With DOMPurify for XSS protection
3. **Production**: With Redis for persistent rate limiting

All features include comprehensive logging for security monitoring.
