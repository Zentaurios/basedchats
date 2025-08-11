import {
  setUserNotificationDetails,
  deleteUserNotificationDetails,
} from "@/lib/notification";
import { sendFrameNotification } from "@/lib/notification-client";
import { http } from "viem";
import { createPublicClient } from "viem";
import { optimism } from "viem/chains";

const appName = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME;

const KEY_REGISTRY_ADDRESS = "0x00000000Fc1237824fb747aBDE0FF18990E59b7e";

const KEY_REGISTRY_ABI = [
  {
    inputs: [
      { name: "fid", type: "uint256" },
      { name: "key", type: "bytes" },
    ],
    name: "keyDataOf",
    outputs: [
      {
        components: [
          { name: "state", type: "uint8" },
          { name: "keyType", type: "uint32" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function verifyFidOwnership(fid: number, appKey: `0x${string}`) {
  const client = createPublicClient({
    chain: optimism,
    transport: http(),
  });

  try {
    const result = await client.readContract({
      address: KEY_REGISTRY_ADDRESS,
      abi: KEY_REGISTRY_ABI,
      functionName: "keyDataOf",
      args: [BigInt(fid), appKey],
    });

    return result.state === 1 && result.keyType === 1;
  } catch (error) {
    console.error("Key Registry verification failed:", error);
    return false;
  }
}

function decode(encoded: string) {
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
}

/**
 * Validate timestamp to prevent replay attacks
 * Using 10-minute window as requested
 */
function validateTimestamp(timestamp: number): boolean {
  if (!timestamp || typeof timestamp !== 'number') {
    return false
  }
  
  const now = Date.now()
  const tenMinutes = 10 * 60 * 1000 // 10 minutes in milliseconds
  
  // Check if timestamp is within 10 minutes (past or future)
  const timeDifference = Math.abs(now - timestamp)
  
  if (timeDifference > tenMinutes) {
    console.warn('[WEBHOOK_SECURITY] Timestamp outside 10-minute window:', {
      timestamp: new Date(timestamp).toISOString(),
      now: new Date(now).toISOString(),
      differenceMinutes: Math.round(timeDifference / 60000)
    })
    return false
  }
  
  return true
}

/**
 * Enhanced security logging for webhook events
 */
function logWebhookEvent(event: {
  type: 'webhook_received' | 'webhook_validated' | 'webhook_rejected'
  fid?: number
  event?: string
  reason?: string
  timestamp?: number
}) {
  console.log('[WEBHOOK_SECURITY]', {
    timestamp: new Date().toISOString(),
    ...event
  })
}

export async function POST(request: Request) {
  const requestJson = await request.json();

  const { header: encodedHeader, payload: encodedPayload } = requestJson;

  // Log incoming webhook
  logWebhookEvent({
    type: 'webhook_received',
    timestamp: Date.now()
  })

  let headerData, event
  try {
    headerData = decode(encodedHeader);
    event = decode(encodedPayload);
  } catch (decodeError) {
    console.error('Webhook decode error:', decodeError)
    logWebhookEvent({
      type: 'webhook_rejected',
      reason: 'Invalid encoding'
    })
    return Response.json(
      { success: false, error: "Invalid webhook data encoding" },
      { status: 400 },
    );
  }

  const { fid, key } = headerData;

  // Validate timestamp if present in event (prevent replay attacks)
  if (event.timestamp && !validateTimestamp(event.timestamp)) {
    logWebhookEvent({
      type: 'webhook_rejected',
      fid,
      reason: 'Timestamp outside 10-minute window'
    })
    return Response.json(
      { success: false, error: "Webhook timestamp outside acceptable window" },
      { status: 400 },
    );
  }

  const valid = await verifyFidOwnership(fid, key);

  if (!valid) {
    logWebhookEvent({
      type: 'webhook_rejected',
      fid,
      reason: 'Invalid FID ownership'
    })
    return Response.json(
      { success: false, error: "Invalid FID ownership" },
      { status: 401 },
    );
  }

  // Log successful validation
  logWebhookEvent({
    type: 'webhook_validated',
    fid,
    event: event.event
  })

  switch (event.event) {
    case "frame_added":
      console.log(
        "frame_added",
        "event.notificationDetails",
        event.notificationDetails,
      );
      if (event.notificationDetails) {
        await setUserNotificationDetails(fid, event.notificationDetails);
        await sendFrameNotification({
          fid,
          title: `Welcome to ${appName}`,
          body: `Thank you for adding ${appName}`,
        });
      } else {
        await deleteUserNotificationDetails(fid);
      }

      break;
    case "frame_removed": {
      console.log("frame_removed");
      await deleteUserNotificationDetails(fid);
      break;
    }
    case "notifications_enabled": {
      console.log("notifications_enabled", event.notificationDetails);
      await setUserNotificationDetails(fid, event.notificationDetails);
      await sendFrameNotification({
        fid,
        title: `Welcome to ${appName}`,
        body: `Thank you for enabling notifications for ${appName}`,
      });

      break;
    }
    case "notifications_disabled": {
      console.log("notifications_disabled");
      await deleteUserNotificationDetails(fid);

      break;
    }
  }

  return Response.json({ success: true });
}
