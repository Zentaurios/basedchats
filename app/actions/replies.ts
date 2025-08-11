'use server'

import { createSigner, checkSignerStatus, getUserByFid, postCastReply, storeUserSigner, getUserSigner, updateSignerStatus, FarcasterUser, UserSigner } from '../../lib/farcaster-auth'

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
    // Get user info first
    const user = await getUserByFid(fid);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Check if user already has a signer
    const signer = await getUserSigner(fid);
    
    if (signer) {
      // Check current status
      const status = await checkSignerStatus(signer.signerUuid);
      
      if (status === 'approved') {
        return { success: true, user };
      } else if (status === 'pending') {
        return { 
          success: false, 
          requiresApproval: true,
          approvalUrl: `https://warpcast.com/~/signer-requests?token=${signer.signerUuid}`,
          user 
        };
      }
      // If revoked or failed, create new signer below
    }

    // Create new signer
    const newSignerData = await createSigner();
    if (!newSignerData) {
      return { success: false, error: 'Failed to create signer' };
    }

    // Store signer info
    const newSigner: UserSigner = {
      fid,
      signerUuid: newSignerData.signerUuid,
      publicKey: newSignerData.publicKey,
      status: 'pending',
      createdAt: Date.now()
    };

    await storeUserSigner(fid, newSigner);

    return {
      success: false,
      requiresApproval: true,
      approvalUrl: newSignerData.deepLinkUrl,
      user
    };

  } catch (error) {
    console.error('Failed to initialize Farcaster auth:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
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
