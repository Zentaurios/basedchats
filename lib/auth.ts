 // BasedChats Mini App - Authentication Utilities
 
 import { redis } from './redis';
 import { AuthSession, AdminVerification } from './types';
 
 // Admin ENS addresses whitelist
 const ADMIN_ENS_ADDRESSES = new Set([
     'webb3fitty.base.eth',
     'thebaron.base.eth'
 ]);
 
 /**
  * Initialize admin whitelist in Redis
  */
 export async function initializeAdminWhitelist(): Promise<void> {
     if (!redis) {
        console.warn('Redis not available for admin initialization');
        return;
    
   }
   
   try {
        // Add admin ENS addresses to Redis set
        const adminAddresses = Array.from(ADMIN_ENS_ADDRESSES);
        if (adminAddresses.length > 0) {
            await redis.sadd('admins', [...adminAddresses]);
        }
            
   } catch (error) {
        console.error('Failed to initialize admin whitelist:', error);
    
   }
}
 
 /**
  * Verify if an ENS address is an admin
  */
 export async function isAdminAddress(ensAddress: string): Promise<boolean> {
     if (!redis) {
        // Fallback to hardcoded check if Redis unavailable
        return ADMIN_ENS_ADDRESSES.has(ensAddress.toLowerCase());
    
   }
   
   try {
        const isAdmin = await redis.sismember('admins', ensAddress.toLowerCase());
        return Boolean(isAdmin);
    
   } catch (error) {
        console.error('Failed to verify admin status:', error);
        // Fallback to hardcoded check
        return ADMIN_ENS_ADDRESSES.has(ensAddress.toLowerCase());
    
   }
}
 
 /**
  * Verify admin status for a session
  */
 export async function verifyAdminSession(session: AuthSession): Promise<AdminVerification> {
     const permissions: AdminVerification['permissions'] = [];
      
      // Check if user has valid ENS name and is in admin list
     if (session.ensName) {
        const isAdmin = await isAdminAddress(session.ensName);
        
        if (isAdmin) {
          permissions.push('add_cast', 'remove_cast', 'export_data', 'view_all');
          return {
            isAdmin: true,
            ensName: session.ensName,
            permissions
    
       };
    }
  }
   
   // Check verified addresses if no ENS
   if (session.verifications && session.verifications.length > 0) {
        for (const verification of session.verifications) {
          const isAdmin = await isAdminAddress(verification);
          if (isAdmin) {
            permissions.push('add_cast', 'remove_cast', 'export_data', 'view_all');
            return {
              isAdmin: true,
              ensName: verification,
              permissions
    
         };
      }
    }
  }
   
   return {
        isAdmin: false,
        permissions: []
    
   };
}
 
 /**
  * Create a session token for authenticated users
  */
 export function createSessionToken(session: AuthSession): string {
      // Simple JWT-like token (in production, use proper JWT library)
     const payload = {
        fid: session.fid,
        username: session.username,
        ensName: session.ensName,
        isAdmin: session.isAdmin,
        timestamp: Date.now()
    
   };
   
   return Buffer.from(JSON.stringify(payload)).toString('base64');
}
 
 /**
  * Parse and validate a session token
  */
 export function parseSessionToken(token: string): AuthSession | null {
     try {
        const payload = JSON.parse(Buffer.from(token, 'base64').toString());
        
        // Validate token structure
        if (!payload.fid || !payload.timestamp) {
          return null;
    
     }
     
     // Check if token is expired (24 hours)
        const tokenAge = Date.now() - payload.timestamp;
     if (tokenAge > 24 * 60 * 60 * 1000) {
          return null;
    
     }
     
     return {
          fid: payload.fid,
          username: payload.username,
          displayName: payload.displayName,
          pfpUrl: payload.pfpUrl,
          custodyAddress: payload.custodyAddress,
          isAdmin: payload.isAdmin || false,
          ensName: payload.ensName,
          verifications: payload.verifications
    
     };
  } catch (error) {
        console.error('Failed to parse session token:', error);
        return null;
    
   }
}
 
 /**
  * Store user session in Redis
  */
 export async function storeUserSession(
     sessionId: string, 
     session: AuthSession
    
 ): Promise<boolean> {
     if (!redis) {
        console.warn('Redis not available for session storage');
        return false;
    
   }
   
   try {
        await redis.setex(`sessions:${sessionId}`, 86400, JSON.stringify(session)); // 24 hour expiry
     return true;
  } catch (error) {
        console.error('Failed to store user session:', error);
        return false;
    
   }
}
 
 /**
  * Retrieve user session from Redis
  */
 export async function getUserSession(sessionId: string): Promise<AuthSession | null> {
     if (!redis) {
        console.warn('Redis not available for session retrieval');
        return null;
    
   }
   
   try {
        const sessionData = await redis.get(`sessions:${sessionId}`);
     if (!sessionData) {
          return null;
    
     }
     
     return JSON.parse(sessionData as string);
  } catch (error) {
        console.error('Failed to retrieve user session:', error);
        return null;
    
   }
}
 
 /**
  * Clear user session from Redis
  */
 export async function clearUserSession(sessionId: string): Promise<boolean> {
     if (!redis) {
        console.warn('Redis not available for session clearing');
        return false;
    
   }
   
   try {
        await redis.del(`sessions:${sessionId}`);
     return true;
  } catch (error) {
        console.error('Failed to clear user session:', error);
        return false;
    
   }
}
 
 /**
  * Validate Farcaster cast hash format
  */
 export function isValidCastHash(hash: string): boolean {
      // Farcaster cast hashes are 40-character hex strings starting with 0x
     const hashRegex = /^0x[a-fA-F0-9]{40}$/;
   return hashRegex.test(hash);
}
 
 /**
  * Extract FID from Farcaster context
  */
 export function extractFidFromContext(context: unknown): number | null {
     try {
        // Type guard for context object
        if (typeof context === 'object' && context !== null && 'user' in context) {
            const user = (context as { user?: unknown }).user;
            if (typeof user === 'object' && user !== null && 'fid' in user) {
                const fid = (user as { fid?: unknown }).fid;
                return typeof fid === 'number' ? fid : null;
            }
        }
        return null;
    
   } catch (error) {
        console.error('Failed to extract FID from context:', error);
        return null;
    
   }
}
 
 /**
  * Format ENS name for display
  */
 export function formatEnsName(ensName: string): string {
     if (ensName.endsWith('.eth')) {
        return ensName;
    
   }
   return `${ensName}.eth`;
}
 
 /**
  * Generate session ID
  */
 export function generateSessionId(): string {
      return Math.random().toString(36).substring(2) + Date.now().toString(36);
    
 }
 
 /**
  * Log admin action for audit trail
  */
 export async function logAdminAction(
     adminEns: string,
     action: string,
     details: Record<string, string | number | boolean>
    
 ): Promise<void> {
     if (!redis) return;
      
      try {
        const logEntry = {
          timestamp: Date.now(),
          admin: adminEns,
          action,
          details
    
     };
     
     // Store in audit log with TTL of 90 days
     const logKey = `audit:${Date.now()}:${Math.random().toString(36).substring(2)}`;
     await redis.setex(logKey, 90 * 24 * 60 * 60, JSON.stringify(logEntry));
  } catch (error) {
        console.error('Failed to log admin action:', error);
    
   }
} 