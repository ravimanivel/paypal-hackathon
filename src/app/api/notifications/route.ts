import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { Notification } from "@/models/Notification";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function GET() {
  try {
    const session = await requireAuth();
    await connectDB();

    const notifications = await Notification.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = notifications.filter((n) => !n.read).length;

    return apiSuccess({
      unreadCount,
      notifications: notifications.map((n) => ({
        id: String(n._id),
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.read,
        link: n.link,
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => ({}));

    await connectDB();
    if (body.notificationId) {
      await Notification.findOneAndUpdate(
        { _id: body.notificationId, userId: session.userId },
        { $set: { read: true } }
      );
    } else {
      await Notification.updateMany(
        { userId: session.userId, read: false },
        { $set: { read: true } }
      );
    }

    return apiSuccess({ updated: true }, "Notifications marked as read");
  } catch (error) {
    return handleApiError(error);
  }
}

