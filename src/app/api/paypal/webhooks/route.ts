import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { Transaction } from "@/models/Transaction";
import { verifyPayPalWebhookSignature } from "@/services/paypal.service";
import { createNotification, recordAuditLog } from "@/lib/security/audit";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const headers: Record<string, string | null> = {
      "paypal-transmission-id": req.headers.get("paypal-transmission-id"),
      "paypal-transmission-time": req.headers.get("paypal-transmission-time"),
      "paypal-transmission-sig": req.headers.get("paypal-transmission-sig"),
      "paypal-cert-url": req.headers.get("paypal-cert-url"),
      "paypal-auth-algo": req.headers.get("paypal-auth-algo"),
    };

    const isSignatureValid = await verifyPayPalWebhookSignature({
      headers,
      rawBody,
    });

    await connectDB();

    if (!isSignatureValid) {
      await recordAuditLog({
        userId: null,
        actorRole: "SYSTEM",
        action: "PAYPAL_WEBHOOK_INVALID_SIGNATURE_REJECTED",
        entityType: "PAYPAL",
        metadata: {
          transmissionId: headers["paypal-transmission-id"] || "missing",
        },
      });
      return apiError(
        "Webhook signature verification failed. Event rejected.",
        401
      );
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.event_type || "UNKNOWN_EVENT";
    const resource = event.resource || {};

    const paypalOrderId =
      resource?.supplementary_data?.related_ids?.order_id ||
      resource?.id;

    let matchedTx = null;
    if (paypalOrderId) {
      matchedTx = await Transaction.findOne({ paypalOrderId });
    }

    if (matchedTx) {
      if (eventType === "CHECKOUT.ORDER.APPROVED") {
        if (matchedTx.paymentStatus === "PAYPAL_ORDER_CREATED") {
          matchedTx.paymentStatus = "CUSTOMER_CHECKOUT_APPROVED";
          await matchedTx.save();
        }
      } else if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
        matchedTx.paymentStatus = "COMPLETED";
        if (resource.id) {
          matchedTx.paypalCaptureId = resource.id;
        }
        await matchedTx.save();

        await createNotification({
          userId: matchedTx.userId,
          title: "PayPal Webhook Confirmed Payment",
          message: `PayPal confirmed capture completion for ${matchedTx.product.name}.`,
          type: "SUCCESS",
          link: `/transactions?highlight=${matchedTx._id}`,
        });
      } else if (
        eventType === "PAYMENT.CAPTURE.DENIED" ||
        eventType === "PAYMENT.CAPTURE.DECLINED"
      ) {
        matchedTx.paymentStatus = "FAILED";
        await matchedTx.save();
      } else if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
        matchedTx.paymentStatus = "REFUNDED";
        await matchedTx.save();
      }
    }

    await recordAuditLog({
      userId: matchedTx?.userId || null,
      actorRole: "SYSTEM",
      action: `PAYPAL_WEBHOOK_${eventType}`,
      entityType: "PAYPAL",
      entityId: event.id || paypalOrderId,
      metadata: {
        eventType,
        paypalOrderId,
        matchedTransactionId: matchedTx ? String(matchedTx._id) : null,
      },
    });

    return apiSuccess(
      {
        verified: true,
        eventType,
        matchedTransactionId: matchedTx ? String(matchedTx._id) : null,
      },
      "PayPal webhook verified and processed"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

