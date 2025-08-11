"use client";

import { useState } from 'react';
import { useViewCast, useOpenUrl, useMiniKit } from "@coinbase/onchainkit/minikit";
import { Card, CardContent, CardFooter, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { EnrichedCast } from "../../lib/cast-enrichment";
import { formatRelativeTime } from "../../lib/utils";
import Image from "next/image";
import { ReplyComposer } from './ReplyComposer';

interface CastCardPropsUpdated {
  cast: EnrichedCast;
  onViewCast: (hash: string) => void;
  showMetadata?: boolean;
  isAdmin?: boolean;
  onRemove?: (hash: string) => void;
}

export function CastCard({
  cast,
  onViewCast,
  showMetadata = false,
  isAdmin = false,
  onRemove
}: CastCardPropsUpdated) {
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const { viewCast } = useViewCast();
  const openUrl = useOpenUrl();
  const { context } = useMiniKit();
  const handleViewCast = () => {
    // If there's an originalUrl (Coinbase wallet URL), open that instead of the Farcaster interface
    if (cast.originalUrl) {
      openUrl(cast.originalUrl);
    } else {
      // Fallback to Farcaster interface
      viewCast({ hash: cast.hash });
    }
    onViewCast(cast.hash);
  };

  const handleReply = () => {
    setShowReplyComposer(true);
  };

  const handleReplyPosted = () => {
    // Optionally refresh the cast or show a success message
    console.log('Reply posted successfully!');
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(cast.hash);
    }
  };

  // Helper function to detect if URL is an image
  const isImageUrl = (url: string): boolean => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const urlLower = url.toLowerCase();
    return imageExtensions.some(ext => urlLower.includes(ext)) || 
           urlLower.includes('ipfs') || 
           urlLower.includes('imagedelivery.net') ||
           urlLower.includes('res.cloudinary.com') ||
           urlLower.includes('pinata.cloud') ||
           urlLower.includes('dweb.link') ||
           urlLower.includes('cloudflare-ipfs.com');
  };

  // Helper function to detect if URL is a video
  const isVideoUrl = (url: string): boolean => {
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi'];
    const urlLower = url.toLowerCase();
    return videoExtensions.some(ext => urlLower.includes(ext));
  };

  // Helper function to clean zoraCoin URLs and extract media URLs
  const extractMediaUrl = (url: string): string | null => {
    // Remove zoraCoin parameter from URLs
    if (url.includes('?zoraCoin=')) {
      return url.split('?zoraCoin=')[0];
    }
    return url;
  };

  // Helper function to check if we should hide a URL (zoraCoin protocol or token swap)
  const shouldHideUrl = (url: string): boolean => {
    return url.startsWith('zoraCoin://') || 
           url.includes('zoraCoin://') ||
           url.includes('wallet.coinbase.com/miniapps/social-swap');
  };

  // Helper function to check if URL is a token swap URL  
  const isTokenSwapUrl = (url: string): boolean => {
    return url.includes('wallet.coinbase.com/miniapps/social-swap');
  };

  // Process cast content to filter out URLs we're displaying as media or don't want to show
  const processedContent = cast.metadata?.content ? (
    cast.metadata.content
      .split('\n')
      .filter(line => {
        const trimmedLine = line.trim();
        // Filter out zoraCoin protocol links
        if (trimmedLine.startsWith('zoraCoin://')) {
          return false;
        }
        // Filter out token swap URLs
        if (isTokenSwapUrl(trimmedLine)) {
          return false;
        }
        // Filter out standalone media URLs (keep text with URLs)
        const urlRegex = /^(https?:\/\/[^\s]+)$/;
        const urlMatch = trimmedLine.match(urlRegex);
        if (urlMatch) {
          const url = urlMatch[1];
          // Hide token swap URLs
          if (isTokenSwapUrl(url)) {
            return false;
          }
          const cleanUrl = extractMediaUrl(url);
          if (cleanUrl && (isImageUrl(cleanUrl) || isVideoUrl(cleanUrl))) {
            return false; // Remove standalone media URLs
          }
        }
        return true;
      })
      // Also filter out token swap URLs that appear inline with text
      .map(line => {
        // Remove token swap URLs from within text lines
        return line.replace(/https:\/\/wallet\.coinbase\.com\/miniapps\/social-swap\S*/g, '').trim();
      })
      .filter(line => line.length > 0) // Remove empty lines after URL removal
      .join('\n')
      .trim()
  ) : '';

  // Extract media URLs from both content and embeds
  const extractAllMedia = (): Array<{url: string, type: 'image' | 'video'}> => {
    const mediaUrls = new Set<string>(); // Prevent duplicates
    const mediaItems: Array<{url: string, type: 'image' | 'video'}> = [];
    
    // Extract from content text
    const content = cast.metadata?.content || '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const contentUrls = content.match(urlRegex) || [];
    
    contentUrls.forEach(url => {
      const cleanUrl = extractMediaUrl(url);
      if (cleanUrl && !shouldHideUrl(url) && !mediaUrls.has(cleanUrl)) {
        if (isImageUrl(cleanUrl)) {
          mediaUrls.add(cleanUrl);
          mediaItems.push({ url: cleanUrl, type: 'image' });
        } else if (isVideoUrl(cleanUrl)) {
          mediaUrls.add(cleanUrl);
          mediaItems.push({ url: cleanUrl, type: 'video' });
        }
      }
    });
    
    // Extract from embeds (THIS IS THE KEY FIX!)
    const embeds = cast.metadata?.embeds || [];
    embeds.forEach(embed => {
      if (embed.url) {
        const cleanUrl = extractMediaUrl(embed.url);
        if (cleanUrl && !shouldHideUrl(embed.url) && !mediaUrls.has(cleanUrl)) {
          if (isImageUrl(cleanUrl)) {
            mediaUrls.add(cleanUrl);
            mediaItems.push({ url: cleanUrl, type: 'image' });
          } else if (isVideoUrl(cleanUrl)) {
            mediaUrls.add(cleanUrl);
            mediaItems.push({ url: cleanUrl, type: 'video' });
          }
        }
      }
    });
    
    return mediaItems;
  };

  const mediaItems = extractAllMedia();

  // Format timestamp for display
  const formatCastTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m`;
    }
  };

  return (
    <Card 
      className={`transition-all duration-200 hover:bg-gray-10/50 dark:hover:bg-gray-80/50 border-gray-15 dark:border-gray-80 ${
        cast.status === 'hidden' ? 'opacity-60' : ''
      }`}
    >
      {/* Cast Header */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            {/* Author Avatar */}
            <div className="flex-shrink-0">
              {cast.metadata?.authorPfp ? (
                <div className="relative">
                  <Image
                    src={cast.metadata.authorPfp}
                    alt={cast.metadata?.author || 'User'}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-15 dark:ring-gray-80"
                    unoptimized={cast.metadata.authorPfp.includes('ipfs') || cast.metadata.authorPfp.includes('pinata')}
                    onError={(e) => {
                      // Fallback to initials if image fails
                      const target = e.target as HTMLImageElement;
                      const container = target.parentElement;
                      if (container) {
                        container.innerHTML = `<div class="w-10 h-10 rounded-full bg-base-blue text-white flex items-center justify-center text-sm font-semibold ring-2 ring-gray-15 dark:ring-gray-80">${cast.metadata?.author?.charAt(0)?.toUpperCase() || cast.metadata?.username?.charAt(0)?.toUpperCase() || '?'}</div>`;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-base-blue text-white flex items-center justify-center text-sm font-semibold ring-2 ring-gray-15 dark:ring-gray-80">
                  {cast.metadata?.author?.charAt(0)?.toUpperCase() || cast.metadata?.username?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>

            {/* Author Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {cast.metadata?.author || 'Unknown'}
                </h3>
                {cast.metadata?.username && (
                  <span className="text-sm text-muted-foreground">
                    @{cast.metadata.username}
                  </span>
                )}
                <span className="text-sm text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">
                  {formatCastTime(cast.metadata?.timestamp)}
                </span>
              </div>
              
              {/* Admin info */}
              {showMetadata && (
                <p className="text-xs text-muted-foreground mt-1">
                  Added by {cast.addedBy} • {formatRelativeTime(cast.addedAt)}
                </p>
              )}
            </div>
          </div>

          {/* Admin Actions */}
          <div className="flex items-center space-x-2">
            {cast.status === 'hidden' && (
              <span className="text-xs bg-gray-15 dark:bg-gray-80 text-muted-foreground px-2 py-1 rounded">
                Hidden
              </span>
            )}
            {cast.originalUrl && (
              <span className="text-xs bg-base-blue/10 text-base-blue px-2 py-1 rounded">
                🏠 Base
              </span>
            )}
            {isAdmin && onRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="text-red hover:text-red hover:bg-red/10 text-xs px-2 py-1 h-auto"
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Cast Content */}
      <CardContent className="pt-0">
        {processedContent && (
          <div className="mb-4">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {processedContent}
            </p>
          </div>
        )}

        {/* Media Content */}
        {mediaItems.length > 0 && (
          <div className="space-y-3 mb-4">
            {mediaItems.map((media, index) => (
              <div key={index} className="rounded-lg overflow-hidden border border-gray-15 dark:border-gray-80 bg-gray-10/20 dark:bg-gray-80/20">
                {media.type === 'image' ? (
                  <Image
                    src={media.url}
                    alt="Cast media"
                    width={500}
                    height={300}
                    className="w-full h-auto max-h-96 object-cover"
                    unoptimized={media.url.includes('ipfs') || media.url.includes('pinata') || media.url.includes('arweave')}
                    onError={(e) => {
                      // Hide broken images gracefully with minimal logging
                      const target = e.target as HTMLImageElement;
                      console.warn('Image failed to load:', media.url);
                      target.style.display = 'none';
                      // Show fallback container
                      const container = target.parentElement;
                      if (container) {
                        container.innerHTML = '<div class="flex items-center justify-center h-32 text-muted-foreground text-sm">Image unavailable</div>';
                      }
                    }}
                    placeholder="blur"
                    blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y1ZjVmNSIvPjwvc3ZnPg=="
                  />
                ) : media.type === 'video' ? (
                  <video
                    src={media.url}
                    controls
                    className="w-full h-auto max-h-96"
                    preload="metadata"
                    onError={(e) => {
                      // Hide broken videos gracefully
                      const target = e.target as HTMLVideoElement;
                      console.warn('Video failed to load:', media.url);
                      target.style.display = 'none';
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Cast Embeds (filtered to exclude media already shown) */}
        {cast.metadata?.embeds && cast.metadata.embeds.length > 0 && (
          <div className="space-y-2 mb-4">
            {cast.metadata.embeds
              .filter(embed => {
                // Don't show embeds for media we're already displaying
                if (!embed.url) return true;
                const cleanUrl = extractMediaUrl(embed.url);
                if (!cleanUrl || shouldHideUrl(embed.url)) return false;
                return !isImageUrl(cleanUrl) && !isVideoUrl(cleanUrl);
              })
              .filter(embed => embed.type === 'link') // Only show non-media link embeds
              .map((embed, index) => (
              <div key={index} className="border border-gray-15 dark:border-gray-80 rounded-lg p-3 bg-gray-10/30 dark:bg-gray-80/30">
                <div>
                  <p className="text-xs text-base-blue font-mono truncate">{embed.url}</p>
                  {embed.metadata?.title && (
                    <p className="text-sm font-medium mt-1">{embed.metadata.title}</p>
                  )}
                  {embed.metadata?.description && (
                    <p className="text-xs text-muted-foreground mt-1">{embed.metadata.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Admin Metadata */}
        {showMetadata && (
          <div className="space-y-2 text-xs text-muted-foreground bg-gray-10/50 dark:bg-gray-80/30 p-3 rounded-lg">
            <div>
              <strong>Hash:</strong> <code className="font-mono text-xs">{cast.hash}</code>
            </div>
            {cast.originalUrl && (
              <div className="text-base-blue">
                <strong>🏠 Base App URL:</strong> <code className="font-mono text-xs break-all">{cast.originalUrl}</code>
              </div>
            )}
            {cast.metadata?.authorFid && (
              <div>
                <strong>Author FID:</strong> {cast.metadata.authorFid}
              </div>
            )}
            <div>
              <strong>Posted:</strong> {cast.metadata?.timestamp ? new Date(cast.metadata.timestamp).toLocaleString() : 'Unknown'}
            </div>
          </div>
        )}
      </CardContent>

      {/* Cast Footer */}
      <CardFooter className="pt-0 pb-4">
        <div className="flex items-center justify-between w-full">
          {/* Reactions Display Only */}
          <div className="flex items-center space-x-4 text-muted-foreground">
            <div className="flex items-center space-x-1 text-xs px-2 py-1">
              <span>💬</span>
              <span>{cast.metadata?.reactions?.replies || 0}</span>
            </div>
            <div className="flex items-center space-x-1 text-xs px-2 py-1">
              <span>🔄</span>
              <span>{cast.metadata?.reactions?.recasts || 0}</span>
            </div>
            <div className="flex items-center space-x-1 text-xs px-2 py-1">
              <span>❤️</span>
              <span>{cast.metadata?.reactions?.likes || 0}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReply}
              className="text-xs px-3 py-1 h-auto"
              title="Join group chat (requires paid Neynar plan)"
            >
              Request to Join
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleViewCast}
              className="text-xs px-3 py-1 h-auto"
            >
              Go to Post
            </Button>
          </div>
        </div>
      </CardFooter>

      {/* Reply Composer Modal */}
      <ReplyComposer
        cast={cast}
        isOpen={showReplyComposer}
        onClose={() => setShowReplyComposer(false)}
        onReplyPosted={handleReplyPosted}
        userFid={context?.user?.fid}
      />
    </Card>
  );
}

// Skeleton loading component for cast cards
export function CastCardSkeleton() {
  return (
    <Card className="border-gray-15 dark:border-gray-80">
      <CardHeader className="pb-3">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-gray-15 dark:bg-gray-80 rounded-full animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center space-x-2">
              <div className="h-4 bg-gray-15 dark:bg-gray-80 rounded w-24 animate-pulse" />
              <div className="h-3 bg-gray-15 dark:bg-gray-80 rounded w-16 animate-pulse" />
            </div>
            <div className="h-3 bg-gray-15 dark:bg-gray-80 rounded w-20 animate-pulse" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2 mb-4">
          <div className="h-4 bg-gray-15 dark:bg-gray-80 rounded w-full animate-pulse" />
          <div className="h-4 bg-gray-15 dark:bg-gray-80 rounded w-4/5 animate-pulse" />
          <div className="h-4 bg-gray-15 dark:bg-gray-80 rounded w-3/5 animate-pulse" />
        </div>
      </CardContent>

      <CardFooter className="pt-0 pb-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-4">
            <div className="h-3 bg-gray-15 dark:bg-gray-80 rounded w-8 animate-pulse" />
            <div className="h-3 bg-gray-15 dark:bg-gray-80 rounded w-8 animate-pulse" />
            <div className="h-3 bg-gray-15 dark:bg-gray-80 rounded w-8 animate-pulse" />
          </div>
          <div className="h-6 bg-gray-15 dark:bg-gray-80 rounded w-20 animate-pulse" />
        </div>
      </CardFooter>
    </Card>
  );
}
