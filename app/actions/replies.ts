'use server'

import { createSigner, checkSignerStatus, getUserByFid, postCastReply, storeUserSigner, getUserSigner, updateSignerStatus, FarcasterUser, UserSigner, testNeynarConnection } from '../../lib/farcaster-auth'
import { redis } from '../../lib/redis'

/**
 * Test environment configuration
 */
export async function testEnvironmentAction(): Promise<{
  success: boolean;
  neynar: { configured: boolean; working?: boolean; error?: string; planLimitation?: boolean };
  redis: { configured: boolean; working?: boolean; error?: string };
  details?: any;
}> {
  const results = {
    success: false,
    neynar: { configured: false },
    redis: { configured: false }
  };

  // Test Neynar API
  try {
    results.neynar.configured = !!process.env.NEYNAR_API_KEY;
    if (results.neynar.configured) {
      const neynarTest = await testNeynarConnection();
      results.neynar.working = neynarTest.success;
      if (!neynarTest.success) {
        results.neynar.error = neynarTest.error;
      }
      
      // Test signer creation to check for plan limitations
      if (neynarTest.success) {
        try {
          await createSigner();
        } catch (error) {
          if (error instanceof Error && error.message.includes('PAYMENT_REQUIRED')) {
            results.neynar.planLimitation = true;
            results.neynar.error = 'Paid plan required for signer creation';
          }
        }
      }
    }
  } catch (error) {
    results.neynar.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Test Redis
  try {
    results.redis.configured = !!redis;
    if (redis) {
      await redis.set('test-key', 'test-value');
      const testValue = await redis.get('test-key');
      results.redis.working = testValue === 'test-value';
      await redis.del('test-key'); // Clean up
    }
  } catch (error) {
    results.redis.error = error instanceof Error ? error.message : 'Unknown error';
  }

  results.success = results.neynar.working && results.redis.working;
  return results;
}

export interface ReplyResult {
  success: boolean;
  cast?: {
    hash: string;
    text?: string;
    author?: {
      fid: number;
      username: string;
      display_name: string;
    };
  };
  error?: string;
  requiresAuth?: boolean;
  signerApprovalUrl?: string;
}

/**
 * Initialize authentication for a user (create signer if needed)
 */
export async function initializeFarcasterAuth(fid: number): Promise<{ 
  success: boolean; 
  requiresApproval?: boolean; 
  approvalUrl?: string;
  user?: FarcasterUser;
  error?: string;
}> {
  try {
    console.log('Initializing Farcaster auth for FID:', fid);
    
    // Check if Neynar API key is available
    if (!process.env.NEYNAR_API_KEY) {
      console.error('Neynar API key not configured');
      return { success: false, error: 'Authentication service not configured' };
    }

    // Get user info first
    console.log('Getting user info for FID:', fid);
    const user = await getUserByFid(fid);
    if (!user) {
      console.error('User not found for FID:', fid);
      return { success: false, error: 'User not found' };
    }
    console.log('User found:', user.username);

    // Check if user already has a signer
    console.log('Checking existing signer for FID:', fid);
    const signer = await getUserSigner(fid);
    
    if (signer) {
      console.log('Existing signer found, checking status:', signer.signerUuid);
      // Check current status
      const status = await checkSignerStatus(signer.signerUuid);
      console.log('Signer status:', status);
      
      if (status === 'approved') {
        console.log('Signer already approved');
        return { success: true, user };
      } else if (status === 'pending') {
        console.log('Signer pending approval');
        return { 
          success: false, 
          requiresApproval: true,
          approvalUrl: `https://warpcast.com/~/signer-requests?token=${signer.signerUuid}`,
          user 
        };
      }
      // If revoked or failed, create new signer below
      console.log('Signer status not approved/pending, creating new signer');
    }

    // Create new signer
    console.log('Creating new signer for FID:', fid);
    try {
      const newSignerData = await createSigner();
      if (!newSignerData) {
        console.error('Failed to create signer - no data returned');
        return { success: false, error: 'Failed to create signer. Please try again.' };
      }
      console.log('New signer created:', newSignerData.signerUuid);
      
      // Store signer info
      const newSigner: UserSigner = {
        fid,
        signerUuid: newSignerData.signerUuid,
        publicKey: newSignerData.publicKey,
        status: 'pending',
        createdAt: Date.now()
      };

      console.log('Storing signer info for FID:', fid);
      const storeResult = await storeUserSigner(fid, newSigner);
      if (!storeResult) {
        console.error('Failed to store signer info');
        return { success: false, error: 'Failed to save authentication info. Please try again.' };
      }
      console.log('Signer stored successfully');

      return {
        success: false,
        requiresApproval: true,
        approvalUrl: newSignerData.deepLinkUrl,
        user
      };
      
    } catch (signerError) {
      console.error('Signer creation error:', signerError);
      
      // Handle payment required error specifically
      if (signerError instanceof Error && signerError.message.includes('PAYMENT_REQUIRED')) {
        return { 
          success: false, 
          error: 'Reply functionality requires a paid Neynar plan. This feature is currently unavailable.' 
        };
      }
      
      return { 
        success: false, 
        error: 'Failed to create authentication signer. Please try again.' 
      };
    }

  } catch (error) {
    console.error('Failed to initialize Farcaster auth:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred. Please try again.' 
    };
  }
}

/**
 * Check if user's signer is approved and ready
 */
export async function checkUserSignerStatus(fid: number): Promise<{
  isReady: boolean;
  status?: 'pending' | 'approved' | 'revoked';
  error?: string;
}> {
  try {
    const signer = await getUserSigner(fid);
    if (!signer) {
      return { isReady: false, error: 'No signer found' };
    }

    const status = await checkSignerStatus(signer.signerUuid);
    if (!status) {
      return { isReady: false, error: 'Failed to check status' };
    }

    // Update local status
    await updateSignerStatus(fid, status);

    return {
      isReady: status === 'approved',
      status
    };

  } catch (error) {
    console.error('Failed to check signer status:', error);
    return { 
      isReady: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Post a reply to a cast
 */
export async function postReplyAction(
  fid: number,
  text: string,
  parentHash: string,
  parentAuthorFid?: number
): Promise<ReplyResult> {
  try {
    // Validate input
    if (!text.trim()) {
      return { success: false, error: 'Reply text cannot be empty' };
    }

    if (text.length > 320) {
      return { success: false, error: 'Reply text too long (max 320 characters)' };
    }

    // Get user's signer
    const signer = await getUserSigner(fid);
    if (!signer) {
      return { 
        success: false, 
        error: 'No signer found', 
        requiresAuth: true 
      };
    }

    // Check signer status
    const status = await checkSignerStatus(signer.signerUuid);
    if (status !== 'approved') {
      return { 
        success: false, 
        error: 'Signer not approved', 
        requiresAuth: true,
        signerApprovalUrl: `https://warpcast.com/~/signer-requests?token=${signer.signerUuid}`
      };
    }

    // Post the reply
    const result = await postCastReply(
      signer.signerUuid,
      text,
      parentHash,
      parentAuthorFid
    );

    if (result.success) {
      return {
        success: true,
        cast: result.cast
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to post reply'
      };
    }

  } catch (error) {
    console.error('Failed to post reply:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get user's Farcaster profile info
 */
export async function getUserProfileAction(fid: number): Promise<{
  success: boolean;
  user?: FarcasterUser;
  error?: string;
}> {
  try {
    const user = await getUserByFid(fid);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    return { success: true, user };

  } catch (error) {
    console.error('Failed to get user profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
