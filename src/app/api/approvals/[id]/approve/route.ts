import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { approveTransactionByUser } from "@/services/approval.service";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    await connectDB();
    const result = await approveTransactionByUser({
      approvalId: id,
      userId: session.userId,
      decisionNote: body?.decisionNote,
    });

    return apiSuccess(
      {
        approvalId: String(result.approval._id),
        status: result.approval.status,
        transactionId: String(result.transaction._id),
        paymentStatus: result.transaction.paymentStatus,
      },
      "Transaction approved in AgentGuard. You may now proceed to PayPal Checkout."
    );
  } catch (error) {
    return handleApiError(error);
  }
}

