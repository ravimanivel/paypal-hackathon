import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { createPayPalOrderForTransaction } from "@/services/paypal.service";
import { apiSuccess, handleApiError } from "@/lib/utils";

const createOrderRequestSchema = z.object({
  transactionId: z.string().min(1, "Transaction ID is required"),
  clientReportedAmountMajor: z.number().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const parsed = createOrderRequestSchema.parse(body);

    await connectDB();
    const result = await createPayPalOrderForTransaction({
      userId: session.userId,
      transactionId: parsed.transactionId,
      clientReportedAmountMajor: parsed.clientReportedAmountMajor,
    });

    return apiSuccess(
      {
        paypalOrderId: result.paypalOrderId,
        approveUrl: result.approveUrl,
        transactionId: String(result.transaction._id),
        paymentStatus: result.transaction.paymentStatus,
        idempotentReplay: result.idempotentReplay,
      },
      "PayPal Sandbox order created"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

