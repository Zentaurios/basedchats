import type { MiniAppNotificationDetails } from "@farcaster/frame-sdk";
import { redis } from "./redis";

const notificationServiceKey =
  process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME ?? "minikit";

function getUserNotificationDetailsKey(fid: number): string {
  return `${notificationServiceKey}:user:${fid}`;
}

export async function getUserNotificationDetails(
  fid: number,
): Promise<MiniAppNotificationDetails | null> {
  if (!redis) {
    return null;
  }

  return await redis.get<MiniAppNotificationDetails>(
    getUserNotificationDetailsKey(fid),
  );
}

export async function setUserNotificationDetails(
  fid: number,
  notificationDetails: MiniAppNotificationDetails,
): Promise<void> {
  if (!redis) {
    return;
  }

  await redis.set(getUserNotificationDetailsKey(fid), notificationDetails);
}

export async function deleteUserNotificationDetails(
  fid: number,
): Promise<void> {
  if (!redis) {
    return;
  }

  await redis.del(getUserNotificationDetailsKey(fid));
}

export async function getAllUsersWithNotifications(): Promise<{ fid: number; details: MiniAppNotificationDetails }[]> {
  if (!redis) {
    return [];
  }

  try {
    // Get all keys for this app's notification users
    const pattern = `${notificationServiceKey}:user:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      return [];
    }

    // Get all notification details for these keys
    const results = await redis.mget(...keys);
    const usersWithNotifications: { fid: number; details: MiniAppNotificationDetails }[] = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const details = results[i] as MiniAppNotificationDetails | null;
      
      if (details) {
        // Extract FID from key (format: "app:user:123")
        const fidMatch = key.match(/:user:(\d+)$/);
        if (fidMatch) {
          const fid = parseInt(fidMatch[1], 10);
          usersWithNotifications.push({ fid, details });
        }
      }
    }

    return usersWithNotifications;
  } catch (error) {
    console.error('Failed to get all users with notifications:', error);
    return [];
  }
}
