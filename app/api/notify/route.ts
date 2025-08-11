// 100% SECURE Admin Notification API - Protected by wallet signature authentication

import { sendFrameNotification } from "@/lib/notification-client";
import { NextRequest, NextResponse } from "next/server";
import { validateAdminSession } from "@/lib/admin-auth";
import { AdminSession } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Validate admin session first
    const authResult = await validateAdminSession();
    
    if (!authResult.isValid || !authResult.session) {
      return NextResponse.json(
        { 
          success: false,
          error: authResult.error || 'Unauthorized - Admin access required',
          code: 'ADMIN_AUTH_REQUIRED'
        },
        { 
          status: 401,
          headers: {
            'WWW-Authenticate': 'Wallet signature required'
          }
        }
      );
    }

    const session = authResult.session as AdminSession;

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin session not found - authentication failed'
        },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { fid, notification } = body;

    // Validate input parameters
    if (!fid || typeof fid !== 'number') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid FID parameter - must be a number' 
        },
        { status: 400 }
      );
    }

    if (!notification || !notification.title || !notification.body) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid notification - title and body are required' 
        },
        { status: 400 }
      );
    }

    // Sanitize notification content
    const sanitizedNotification = {
      title: notification.title.trim().substring(0, 100), // Limit title length
      body: notification.body.trim().substring(0, 500),   // Limit body length
      notificationDetails: notification.notificationDetails
    };

    /* Log admin action for audit trail
    await logAdminAction(session, 'SEND_NOTIFICATION', {
      fid,
      title: sanitizedNotification.title,
      bodyLength: sanitizedNotification.body.length,
      timestamp: Date.now()
    });*/

    const result = await sendFrameNotification({
      fid,
      title: sanitizedNotification.title,
      body: sanitizedNotification.body,
      notificationDetails: sanitizedNotification.notificationDetails,
    });

    if (result.state === "error") {
      /* Log failed notification for monitoring
      await logAdminAction(session, 'SEND_NOTIFICATION_FAILED', {
        fid,
        error: result.error,
        timestamp: Date.now()
      });*/

      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to send notification' // Don't leak internal error details
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Notification sent successfully'
    }, { status: 200 });
    
  } catch (error) {
    console.error('Notification API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process notification request", // Generic error message
      },
      { status: 500 }
    );
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_URL || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
