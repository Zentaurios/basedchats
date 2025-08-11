// BasedChats Mini App - Public Casts API

import { NextRequest, NextResponse } from 'next/server';
import { getActiveCasts, searchCasts } from '../../../lib/utils';
import { enrichCastsWithMetadata, EnrichedCast } from '../../../lib/cast-enrichment';
import { CastsResponse } from '../../../lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const query = searchParams.get('query');
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { 
          success: false,
          casts: [] as EnrichedCast[],
          total: 0,
          error: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-100.' 
        },
        { status: 400 }
      );
    }
    
    let response: CastsResponse<EnrichedCast>;
    
    if (query && query.trim()) {
      // Search functionality
      const results = await searchCasts(query.trim(), true); // activeOnly = true
      
      // Apply pagination to search results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedResults = results.slice(startIndex, endIndex);
      
      // Enrich search results with metadata
      const enrichedResults = await enrichCastsWithMetadata(paginatedResults);
      
      response = {
        success: true,
        casts: enrichedResults,
        total: results.length,
        page,
        limit
      };
    } else {
      // Regular paginated feed
      const castsResponse = await getActiveCasts(page, limit);
      
      if (castsResponse.success && castsResponse.casts.length > 0) {
        // Enrich casts with metadata
        const enrichedCasts = await enrichCastsWithMetadata(castsResponse.casts);
        
        // Create new response with enriched casts
        response = {
          success: true,
          casts: enrichedCasts,
          total: castsResponse.total,
          page: castsResponse.page,
          limit: castsResponse.limit
        };
      } else {
        // Handle empty or failed response
        response = {
          success: castsResponse.success,
          casts: [], // Empty enriched casts array
          total: castsResponse.total,
          page: castsResponse.page,
          limit: castsResponse.limit,
          error: castsResponse.success ? undefined : 'No casts found'
        };
      }
    }
    
    // Set cache headers for better performance
    const headers = {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      'Content-Type': 'application/json'
    };
    
    return NextResponse.json(response, { headers });
    
  } catch (error) {
    console.error('❌ API Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        casts: [] as EnrichedCast[],
        total: 0,
        error: error instanceof Error ? error.message : 'Failed to fetch casts'
      },
      { status: 500 }
    );
  }
}

// Rate limiting middleware (in production, use a proper rate limiter)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Note: Function defined but not used in current implementation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function checkRateLimit(clientId: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const clientData = requestCounts.get(clientId);
  
  if (!clientData || now > clientData.resetTime) {
    requestCounts.set(clientId, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (clientData.count >= limit) {
    return false;
  }
  
  clientData.count++;
  return true;
}

// Add OPTIONS handler for CORS if needed
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}