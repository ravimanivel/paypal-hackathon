import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { capturePayPalOrderForTransaction } from "@/services/paypal.service";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";

const captureRequestSchema = z.object({
  transactionId: z.string().min(1, "Transaction ID is required"),
  paypalOrderId: z.string().min(1, "PayPal Order ID is required"),
  clientReportedAmountMajor: z.number().positive().optional(),
  actorRole: z.enum(["USER", "ADMIN", "AGENT"]).optional(),
  simulateOutcome: z.enum(["SUCCESS", "FAILED"]).optional(),
  failureReason: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const parsed = captureRequestSchema.parse(body);

    // Block any request attempting to execute capture as an AI Agent
    if (
      parsed.actorRole === "AGENT" ||
      req.headers.get("x-agentguard-actor") === "AGENT"
    ) {
      return apiError(
        "SECURITY_VIOLATION: AI Agents are strictly forbidden from capturing PayPal orders directly.",
        403
      );
    }

    await connectDB();
    const result = await capturePayPalOrderForTransaction({
      userId: session.userId,
      actorRole: session.role,
      transactionId: parsed.transactionId,
      paypalOrderId: parsed.paypalOrderId,
      clientReportedAmountMajor: parsed.clientReportedAmountMajor,
      simulateOutcome: parsed.simulateOutcome,
      failureReason: parsed.failureReason,
    });

    return apiSuccess(
      {
        transactionId: String(result.transaction._id),
        paypalOrderId: result.transaction.paypalOrderId,
        paypalCaptureId: result.captureId,
        paymentStatus: result.transaction.paymentStatus,
        simulatedFailureReason: result.simulatedFailureReason,
        idempotentReplay: result.idempotentReplay,
      },
      result.transaction.paymentStatus === "FAILED"
        ? "PayPal payment failed during capture simulation"
        : "PayPal payment verified and captured successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

