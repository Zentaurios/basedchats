// Signer Management for Farcaster Integration
// Handles user authentication and signer creation/retrieval

export interface UserSigner {
  fid: number;
  signerUuid: string;
  publicKey: string;
  status: 'pending' | 'approved' | 'revoked';
  createdAt: number;
}

export interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
  custodyAddress: string;
}

/**
 * Create a new signer for a user via Neynar API
 */
export async function createSigner(): Promise<{ signerUuid: string; publicKey: string; deepLinkUrl: string } | null> {
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  
  if (!neynarApiKey) {
    console.error('Neynar API key not configured');
    return null;
  }

  try {
    const response = await fetch('https://api.neynar.com/v2/farcaster/signer', {
      method: 'POST',
      headers: {
        'x-api-key': neynarApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to create signer:', response.status);
      return null;
    }

    const data = await response.json();
    
    return {
      signerUuid: data.signer_uuid,
      publicKey: data.public_key,
      deepLinkUrl: data.signer_approval_url
    };

  } catch (error) {
    console.error('Error creating signer:', error);
    return null;
  }
}

/**
 * Check signer status via Neynar API
 */
export async function checkSignerStatus(signerUuid: string): Promise<'pending' | 'approved' | 'revoked' | null> {
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  
  if (!neynarApiKey) {
    console.error('Neynar API key not configured');
    return null;
  }

  try {
    const response = await fetch(`https://api.neynar.com/v2/farcaster/signer?signer_uuid=${signerUuid}`, {
      method: 'GET',
      headers: {
        'x-api-key': neynarApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to check signer status:', response.status);
      return null;
    }

    const data = await response.json();
    return data.status;

  } catch (error) {
    console.error('Error checking signer status:', error);
    return null;
  }
}

/**
 * Get user info by FID via Neynar API
 */
export async function getUserByFid(fid: number): Promise<FarcasterUser | null> {
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  
  if (!neynarApiKey) {
    console.error('Neynar API key not configured');
    return null;
  }

  try {
    const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      method: 'GET',
      headers: {
        'x-api-key': neynarApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to get user info:', response.status);
      return null;
    }

    const data = await response.json();
    const user = data.users?.[0];
    
    if (!user) {
      return null;
    }

    return {
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
      custodyAddress: user.custody_address
    };

  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

/**
 * Post a cast reply via Neynar API
 */
export async function postCastReply(
  signerUuid: string,
  text: string,
  parentHash: string,
  parentAuthorFid?: number
): Promise<{ success: boolean; cast?: { hash: string; text?: string; author?: { fid: number; username: string; display_name: string } }; error?: string }> {
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  
  if (!neynarApiKey) {
    return { success: false, error: 'Neynar API key not configured' };
  }

  try {
    const requestBody = {
      signer_uuid: signerUuid,
      text: text.trim(),
      parent: parentHash,
      ...(parentAuthorFid && { parent_author_fid: parentAuthorFid }),
      idem: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Unique idempotency key
    };

    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'x-api-key': neynarApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Failed to post cast reply:', response.status, errorData);
      return { 
        success: false, 
        error: `Failed to post reply: ${response.status}` 
      };
    }

    const data = await response.json();
    
    if (data.success) {
      return { 
        success: true, 
        cast: data.cast 
      };
    } else {
      return { 
        success: false, 
        error: 'Neynar API returned success: false' 
      };
    }

  } catch (error) {
    console.error('Error posting cast reply:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Storage helpers for user signers (using Redis)
 */
import { redis } from './redis';

export async function storeUserSigner(fid: number, signer: UserSigner): Promise<boolean> {
  if (!redis) return false;
  
  try {
    await redis.set(`signer:${fid}`, JSON.stringify(signer));
    return true;
  } catch (error) {
    console.error('Failed to store user signer:', error);
    return false;
  }
}

export async function getUserSigner(fid: number): Promise<UserSigner | null> {
  if (!redis) return null;
  
  try {
    const data = await redis.get(`signer:${fid}`);
    if (!data) return null;
    
    return JSON.parse(data as string);
  } catch (error) {
    console.error('Failed to get user signer:', error);
    return null;
  }
}

export async function updateSignerStatus(fid: number, status: UserSigner['status']): Promise<boolean> {
  if (!redis) return false;
  
  try {
    const signer = await getUserSigner(fid);
    if (!signer) return false;
    
    signer.status = status;
    await redis.set(`signer:${fid}`, JSON.stringify(signer));
    return true;
  } catch (error) {
    console.error('Failed to update signer status:', error);
    return false;
  }
}
