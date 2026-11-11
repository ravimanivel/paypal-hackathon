import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongodb";
import { requireAdmin } from "@/lib/auth/session";
import { User } from "@/models/User";
import { Transaction } from "@/models/Transaction";
import { recordAuditLog } from "@/lib/security/audit";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";

const adminUpdateUserSchema = z.object({
  userId: z.string().min(1),
  accountStatus: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]),
  reason: z.string().max(300).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    const users = await User.find().sort({ createdAt: -1 }).lean();
    const transactions = await Transaction.find()
      .select("userId amount paymentStatus firewallDecision")
      .lean();

    const txByUser = new Map<
      string,
      { total: number; blocked: number; completed: number }
    >();
    for (const t of transactions) {
      const uid = String(t.userId);
      const cur = txByUser.get(uid) || { total: 0, blocked: 0, completed: 0 };
      cur.total += 1;
      if (t.firewallDecision === "BLOCKED") cur.blocked += 1;
      if (t.paymentStatus === "COMPLETED") cur.completed += 1;
      txByUser.set(uid, cur);
    }

    const filtered = users.filter((u) => {
      if (!search) return true;
      return (
        u.name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
      );
    });

    return apiSuccess({
      users: filtered.map((u) => {
        const stats = txByUser.get(String(u._id)) || {
          total: 0,
          blocked: 0,
          completed: 0,
        };
        return {
          id: String(u._id),
          name: u.name,
          email: u.email,
          role: u.role,
          accountStatus: u.accountStatus,
          preferredCurrency: u.preferredCurrency,
          onboardingCompleted: u.onboardingCompleted,
          paypalConnected: u.paypalConnected,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
          transactionStats: stats,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminSession = await requireAdmin();
    const body = await req.json();
    const parsed = adminUpdateUserSchema.parse(body);

    if (!mongoose.Types.ObjectId.isValid(parsed.userId)) {
      return apiError("Invalid user ID", 400);
    }

    if (String(parsed.userId) === String(adminSession.userId)) {
      return apiError(
        "Administrators cannot disable their own active account.",
        400
      );
    }

    await connectDB();
    const targetUser = await User.findById(parsed.userId);
    if (!targetUser) {
      return apiError("User not found", 404);
    }

    const previousStatus = targetUser.accountStatus;
    targetUser.accountStatus = parsed.accountStatus;
    await targetUser.save();

    await recordAuditLog({
      userId: adminSession.userId,
      actorRole: "ADMIN",
      action: `ADMIN_USER_STATUS_${parsed.accountStatus}`,
      entityType: "USER",
      entityId: String(targetUser._id),
      metadata: {
        targetUserEmail: targetUser.email,
        previousStatus,
        newStatus: parsed.accountStatus,
        reason: parsed.reason || "Administrative action",
      },
    });

    return apiSuccess(
      {
        user: {
          id: String(targetUser._id),
          name: targetUser.name,
          email: targetUser.email,
          accountStatus: targetUser.accountStatus,
        },
      },
      `User account status updated to ${parsed.accountStatus}`
    );
  } catch (error) {
    return handleApiError(error);
  }
}

