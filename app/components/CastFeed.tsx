"use client";

import { useState, useEffect } from "react";
import { CastCard, CastCardSkeleton } from "./CastCard";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
// import { StoredCast } from "../../lib/types"; // Commented out as it's not used
import { EnrichedCast } from "../../lib/cast-enrichment";

interface CastFeedProps {
  casts: EnrichedCast[]
  loading?: boolean
  error?: string
  onRefresh?: () => void
  onSearch?: (query: string) => void
}

export function CastFeed({ 
  casts = [], 
  loading = false, 
  error, 
  onRefresh,
  onSearch
}: CastFeedProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Handle search with debouncing
  useEffect(() => {
    if (!onSearch) return;
    
    const debounceTimer = setTimeout(() => {
      onSearch(searchQuery);
    }, 300);
    
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, onSearch]);

  const handleViewCast = (hash: string) => {
    console.log(`Viewing cast: ${hash}`);
    // Additional analytics or tracking could go here
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        {onRefresh && (
          <Button onClick={onRefresh} variant="secondary">
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Section */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <Input
            variant="search"
            placeholder="Search group chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
            >
              Clear
            </Button>
          )}
          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              loading={loading}
            >
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Results Summary */}
      {searchQuery && (
        <div className="text-sm text-muted-foreground">
          {loading ? (
            "Searching..."
          ) : (
            `Found ${casts.length} result${casts.length === 1 ? '' : 's'} for "${searchQuery}"`
          )}
        </div>
      )}

      {/* Cast Feed */}
      {loading ? (
        <div className="space-y-4 max-w-2xl mx-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <CastCardSkeleton key={i} />
          ))}
        </div>
      ) : casts.length > 0 ? (
        <div className="space-y-4 max-w-2xl mx-auto">
          {casts.map((cast) => (
            <CastCard
              key={cast.hash}
              cast={cast}
              onViewCast={handleViewCast}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {searchQuery ? "No results found" : "No group chats yet"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery 
              ? "Try adjusting your search terms or check back later."
              : "Check back soon for curated group chat invites!"}
          </p>
          {searchQuery && (
            <Button
              variant="secondary"
              onClick={clearSearch}
            >
              Clear Search
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
