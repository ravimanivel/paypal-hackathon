import mongoose from "mongoose";
import { AuditLog } from "@/models/AuditLog";
import { Notification } from "@/models/Notification";
import { sanitizeAuditMetadata } from "@/lib/security/rate-limit";

export async function recordAuditLog(params: {
  userId?: string | mongoose.Types.ObjectId | null;
  actorRole: "USER" | "ADMIN" | "SYSTEM" | "AGENT";
  action: string;
  entityType:
    | "USER"
    | "POLICY"
    | "AGENT"
    | "TRANSACTION"
    | "APPROVAL"
    | "PAYPAL"
    | "SYSTEM";
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const safeMetadata = sanitizeAuditMetadata(params.metadata);
    const userObjectId =
      params.userId && mongoose.Types.ObjectId.isValid(String(params.userId))
        ? new mongoose.Types.ObjectId(String(params.userId))
        : null;

    await AuditLog.create({
      userId: userObjectId,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: safeMetadata,
    });
  } catch (err) {
    console.error(
      "[AuditLog Error]: Failed to write audit log:",
      err instanceof Error ? err.message : "Unknown error"
    );
  }
}

export async function createNotification(params: {
  userId: string | mongoose.Types.ObjectId;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "DANGER" | "APPROVAL_REQUIRED";
  link?: string;
}) {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(params.userId))) return;
    await Notification.create({
      userId: new mongoose.Types.ObjectId(String(params.userId)),
      title: params.title,
      message: params.message,
      type: params.type || "INFO",
      link: params.link,
      read: false,
    });
  } catch (err) {
    console.error(
      "[Notification Error]:",
      err instanceof Error ? err.message : "Unknown error"
    );
  }
}

