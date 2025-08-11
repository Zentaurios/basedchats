// 100% SECURE Admin CSV Export API - Protected by wallet signature authentication

import { NextResponse } from 'next/server'
import { withAdminAuth } from '../../../../lib/admin-auth'
import { getAllCasts, generateCSVExport, generateExportFilename } from '../../../../lib/utils'
import { AdminSession } from '../../../../lib/types'

// GET - Export all casts as CSV (100% SECURE - Only authenticated admin wallets)
export const GET = withAdminAuth(async (session: AdminSession) => {
  try {
    /* Log admin action for audit trail - this is sensitive data export
    await logAdminAction(session, 'EXPORT_DATA', {
      timestamp: Date.now(),
      type: 'csv_export',
      sensitivity: 'high'
    })*/
    if (!session) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized - Admin session required',
          code: 'ADMIN_AUTH_REQUIRED'
        },
        { status: 401 }
      )
    }
    // Get all casts (including hidden ones for admin export)
    const casts = await getAllCasts()
    
    // Generate CSV with full metadata for admin export
    const csvContent = generateCSVExport(casts, {
      filename: generateExportFilename(),
      includeMetadata: true // Admin gets full data
    })
    
    // Generate secure filename with timestamp
    const filename = generateExportFilename()
    
    // Return CSV as downloadable file with security headers
    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=\"${filename}\"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-Download-Options': 'noopen',
      },
    })
    
  } catch (error) {
    console.error('Failed to export casts:', error)
    
    /* Log the failed export attempt
    await logAdminAction(session, 'EXPORT_DATA_FAILED', {
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    })*/
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export casts'
      },
      { status: 500 }
    )
  }
})

// OPTIONS handler for CORS with enhanced security
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_URL || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
