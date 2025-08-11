"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { useOpenUrl } from '@coinbase/onchainkit/minikit';
import Image from 'next/image';
import { EnrichedCast } from '../../lib/cast-enrichment';
import { FarcasterUser } from '../../lib/farcaster-auth';
import { postReplyAction, initializeFarcasterAuth, checkUserSignerStatus, getUserProfileAction, testEnvironmentAction } from '../actions/replies';

interface ReplyComposerProps {
  cast: EnrichedCast;
  isOpen: boolean;
  onClose: () => void;
  onReplyPosted?: () => void;
  userFid?: number; // From Base App context
}

export function ReplyComposer({ 
  cast, 
  isOpen, 
  onClose, 
  onReplyPosted,
  userFid 
}: ReplyComposerProps) {
  const [replyText, setReplyText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [authStatus, setAuthStatus] = useState<'unknown' | 'ready' | 'needs_approval' | 'needs_init'>('unknown');
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const openUrl = useOpenUrl();

  const checkAuthStatus = useCallback(async () => {
    if (!userFid) {
      setAuthStatus('needs_init');
      setError('User FID not available');
      return;
    }

    try {
      // Get user profile
      const profileResult = await getUserProfileAction(userFid);
      if (profileResult.success && profileResult.user) {
        setUser(profileResult.user);
      }

      // Check signer status
      const statusResult = await checkUserSignerStatus(userFid);
      
      if (statusResult.isReady) {
        setAuthStatus('ready');
      } else if (statusResult.status === 'pending') {
        setAuthStatus('needs_approval');
        setApprovalUrl(`https://warpcast.com/~/signer-requests`);
      } else {
        setAuthStatus('needs_init');
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setAuthStatus('needs_init');
      setError('Failed to check authentication status');
    }
  }, [userFid]); // Only re-create when userFid changes

  // Check authentication status when component opens
  useEffect(() => {
    if (isOpen && userFid) {
      checkAuthStatus();
    }
  }, [isOpen, userFid, checkAuthStatus]);

  // Clear states when closing
  useEffect(() => {
    if (!isOpen) {
      setReplyText('');
      setError(null);
      setSuccess(false);
      setDebugInfo(null);
    }
  }, [isOpen]);

  const handleInitializeAuth = async () => {
    if (!userFid) {
      setError('User FID not available');
      return;
    }

    setIsPosting(true);
    setError(null);

    try {
      const result = await initializeFarcasterAuth(userFid);
      
      if (result.success) {
        setAuthStatus('ready');
        if (result.user) setUser(result.user);
      } else if (result.requiresApproval) {
        setAuthStatus('needs_approval');
        setApprovalUrl(result.approvalUrl || null);
        if (result.user) setUser(result.user);
      } else {
        setError(result.error || 'Failed to initialize authentication');
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      setError('Failed to initialize authentication');
    } finally {
      setIsPosting(false);
    }
  };

  const handleOpenApproval = () => {
    if (approvalUrl) {
      openUrl(approvalUrl);
    } else {
      openUrl('https://warpcast.com/~/signer-requests');
    }
  };

  const handlePostReply = async () => {
    if (!userFid || !replyText.trim()) return;

    setIsPosting(true);
    setError(null);

    try {
      const result = await postReplyAction(
        userFid,
        replyText.trim(),
        cast.hash,
        cast.metadata?.authorFid
      );

      if (result.success) {
        setSuccess(true);
        setReplyText('');
        // Close after 2 seconds
        setTimeout(() => {
          onClose();
          onReplyPosted?.();
        }, 2000);
      } else if (result.requiresAuth) {
        setAuthStatus('needs_approval');
        setApprovalUrl(result.signerApprovalUrl || null);
        setError(result.error || 'Authentication required');
      } else {
        setError(result.error || 'Failed to post reply');
      }
    } catch (error) {
      console.error('Failed to post reply:', error);
      setError('Failed to post reply');
    } finally {
      setIsPosting(false);
    }
  };

  const handleTestEnvironment = async () => {
    try {
      const results = await testEnvironmentAction();
      console.log('Environment test results:', results);
      
      let debugMessage = 'Environment Test:\n';
      debugMessage += `Neynar API: ${results.neynar.configured ? 'Configured' : 'Not configured'}`;
      if (results.neynar.configured) {
        debugMessage += ` - ${results.neynar.working ? 'Working' : 'Failed'}`;
        if (results.neynar.planLimitation) {
          debugMessage += ' (Free plan - paid features unavailable)';
        }
        if (results.neynar.error && !results.neynar.planLimitation) {
          debugMessage += ` (${results.neynar.error})`;
        }
      }
      debugMessage += '\n';
      debugMessage += `Redis: ${results.redis.configured ? 'Configured' : 'Not configured'}`;
      if (results.redis.configured) {
        debugMessage += ` - ${results.redis.working ? 'Working' : 'Failed'}`;
        if (results.redis.error) {
          debugMessage += ` (${results.redis.error})`;
        }
      }
      
      if (results.neynar.planLimitation) {
        debugMessage += '\n\nℹ️ To enable replies, upgrade to a paid Neynar plan at https://neynar.com/#pricing';
      }
      
      setDebugInfo(debugMessage);
      
      if (!results.success && !results.neynar.planLimitation) {
        setError('Environment configuration issues detected. Check console for details.');
      } else if (results.neynar.planLimitation) {
        setError('Reply functionality requires a paid Neynar plan.');
      }
    } catch (error) {
      console.error('Failed to test environment:', error);
      setError('Failed to test environment configuration');
    }
  };

  const characterCount = replyText.length;
  const maxLength = 320;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border-border shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Reply to Cast</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-auto p-1"
            >
              ✕
            </Button>
          </div>
          <CardDescription>
            Replying to {cast.metadata?.author || 'Unknown'} (@{cast.metadata?.username || 'unknown'})
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* User FID Check */}
          {!userFid ? (
            <div className="p-3 bg-yellow-50/80 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-card-foreground">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Please sign in to Base App to reply to casts.
              </p>
            </div>
          ) : (
            <>
              {/* Original Cast Preview */}
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="flex items-start space-x-2">
                  {cast.metadata?.authorPfp && (
                    <Image
                      src={cast.metadata.authorPfp}
                      alt={cast.metadata?.author || 'Unknown'}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cast.metadata?.author || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {cast.metadata?.content || 'No content'}
                    </p>
                  </div>
                </div>
              </div>

          {/* Authentication Status */}
          {authStatus === 'needs_init' && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-card-foreground">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                  Reply functionality requires authorization
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Note: This feature requires a paid Neynar plan. If you're using the free tier, you'll see a payment error.
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={handleInitializeAuth}
                  loading={isPosting}
                  className="flex-1"
                >
                  Try Authorization
                </Button>
                <Button
                  onClick={handleTestEnvironment}
                  variant="secondary"
                  size="sm"
                  className="px-2"
                  title="Test environment configuration"
                >
                  🔧
                </Button>
              </div>
            </div>
          )}

          {authStatus === 'needs_approval' && (
            <div className="space-y-3">
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                  Authorization pending. Please approve the signer request in Warpcast.
                </p>
                {user && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Posting as: {user.displayName} (@{user.username})
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={handleOpenApproval}
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                >
                  Open Warpcast
                </Button>
                <Button
                  onClick={checkAuthStatus}
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                >
                  Check Status
                </Button>
              </div>
            </div>
          )}

          {/* Reply Composer */}
          {authStatus === 'ready' && (
            <div className="space-y-3">
              {user && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  {user.pfpUrl && (
                    <Image
                      src={user.pfpUrl}
                      alt={user.displayName}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  )}
                  <span>Posting as {user.displayName} (@{user.username})</span>
                </div>
              )}

              <div className="space-y-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write your reply..."
                  className="w-full min-h-[100px] p-3 border border-input rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
                  maxLength={maxLength}
                />
                <div className="flex justify-between items-center text-xs">
                  <span className={`${characterCount > maxLength - 50 ? 'text-red' : 'text-muted-foreground'}`}>
                    {characterCount}/{maxLength}
                  </span>
                </div>
              </div>

              <Button
                onClick={handlePostReply}
                loading={isPosting}
                disabled={!replyText.trim() || characterCount > maxLength}
                className="w-full"
              >
                {isPosting ? 'Posting Reply...' : 'Post Reply'}
              </Button>
            </div>
          )}

          {/* Success State */}
          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✅ Reply posted successfully! Closing...
              </p>
            </div>
          )}

          {/* Debug Info */}
          {debugInfo && (
            <div className="p-3 bg-muted/50 border border-border rounded-lg">
              <p className="text-xs font-mono text-muted-foreground whitespace-pre-line">
                {debugInfo}
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">
                {error}
              </p>
            </div>
          )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
