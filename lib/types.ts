// BasedChats Mini App - TypeScript Type Definitions

import type { AuthorizedAddress } from './auth-utils'

// Core data structures
export interface StoredCast {
  hash: string;              // Farcaster cast hash
  addedBy: string;           // Admin ENS who added it
  addedAt: number;           // Unix timestamp
  originalUrl?: string;      // Original URL (e.g., coinbase wallet link)
  metadata?: {
    author?: string;         // Cast author display name
    username?: string;       // Cast author username (@handle)
    authorFid?: number;      // Author's FID
    authorPfp?: string;      // Author profile picture URL
    content?: string;        // Cast text content
    timestamp?: number;      // Cast creation time
    parentHash?: string;     // Parent cast hash if reply
    embeds?: CastEmbed[];    // Cast embeds (images, links, etc.)
    reactions?: {
      likes?: number;        // Number of likes
      recasts?: number;      // Number of recasts
      replies?: number;      // Number of replies
    };
  };
  status: 'active' | 'hidden'; // Moderation status
}

export interface AdminSession {
  address: AuthorizedAddress
  issuedAt: number
  expiresAt: number
  addressVersion: string // For invalidating sessions when admin list changes
}

export interface CastEmbed {
  type: 'image' | 'video' | 'link' | 'cast';
  url?: string;
  metadata?: {
    title?: string;
    description?: string;
    image?: string;
  };
}

// Authentication types
export interface AuthSession {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  custodyAddress?: string;
  isAdmin: boolean;
  ensName?: string;
  verifications?: string[];
}

export interface QuickAuthResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
}

// API response types - Generic for both StoredCast and EnrichedCast
export interface CastsResponse<T = StoredCast> {
  success: boolean;
  casts: T[];
  total: number;
  page?: number;
  limit?: number;
  error?: string;
}

export interface AddCastRequest {
  hash: string;
  adminEns: string;
}

export interface AddCastResponse {
  success: boolean;
  cast?: StoredCast;
  error?: string;
}

export interface RemoveCastRequest {
  hash: string;
  adminEns: string;
}

export interface RemoveCastResponse {
  success: boolean;
  error?: string;
}

// Admin management types
export interface AdminVerification {
  isAdmin: boolean;
  ensName?: string;
  permissions: AdminPermission[];
}

export type AdminPermission = 'add_cast' | 'remove_cast' | 'export_data' | 'view_all';

// Component prop types
export interface CastCardProps {
  cast: StoredCast;
  onViewCast: (hash: string) => void;
  showMetadata?: boolean;
  isAdmin?: boolean;
  onRemove?: (hash: string) => void;
}

export interface CastFeedProps {
  casts: StoredCast[];
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onSearch?: (query: string) => void;
}

export interface AdminPanelProps {
  session: AuthSession;
  onAddCast: (hash: string) => Promise<boolean>;
  onRemoveCast: (hash: string) => Promise<boolean>;
  onExport: () => Promise<void>;
}

export interface ThemeToggleProps {
  className?: string;
}

export interface NavigationProps {
  isAdmin: boolean;
}

// Search and filter types
export interface SearchFilters {
  query: string;
  author?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: 'active' | 'hidden' | 'all';
}

export interface SearchState {
  filters: SearchFilters;
  results: StoredCast[];
  loading: boolean;
  total: number;
}

// Redis key types for type safety
export type RedisKey = 
  | `casts:${string}`           // Individual cast data
  | 'casts:active'              // Set of active cast hashes
  | 'casts:all'                 // Set of all cast hashes
  | 'admins'                    // Set of admin ENS addresses
  | `sessions:${string}`;       // User session data

// Environment variables type
export interface EnvironmentConfig {
  NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME: string;
  NEXT_PUBLIC_URL: string;
  NEXT_PUBLIC_ONCHAINKIT_API_KEY: string;
  REDIS_URL: string;
  REDIS_TOKEN: string;
  FARCASTER_HEADER?: string;
  FARCASTER_PAYLOAD?: string;
  FARCASTER_SIGNATURE?: string;
}

// Error types
export class CastFeedError extends Error {
  constructor(
    message: string,
    public code: CastFeedErrorCode,
    public details?: unknown
  ) {
    super(message);
    this.name = 'CastFeedError';
  }
}

export enum CastFeedErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  CAST_NOT_FOUND = 'CAST_NOT_FOUND',
  CAST_ALREADY_EXISTS = 'CAST_ALREADY_EXISTS',
  INVALID_HASH = 'INVALID_HASH',
  REDIS_ERROR = 'REDIS_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  ADMIN_REQUIRED = 'ADMIN_REQUIRED'
}

// Utility types
export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Event types for analytics/tracking
export interface AnalyticsEvent {
  type: 'cast_viewed' | 'cast_added' | 'cast_removed' | 'search_performed' | 'theme_changed';
  timestamp: number;
  userId?: string;
  data?: Record<string, unknown>;
}

// CSV export types
export interface CSVExportData {
  hash: string;
  addedBy: string;
  addedAt: string; // ISO date string
  status: string;
  author?: string;
  content?: string;
  castTimestamp?: string; // ISO date string
}

export interface ExportConfig {
  filename: string;
  includeMetadata: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}
