import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return apiSuccess({ authenticated: false, user: null }, "No active session");
    }

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user || user.accountStatus !== "ACTIVE") {
      return apiSuccess({ authenticated: false, user: null }, "Session invalid");
    }

    return apiSuccess(
      {
        authenticated: true,
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
          preferredCurrency: user.preferredCurrency,
          onboardingCompleted: user.onboardingCompleted,
          onboardingStep: user.onboardingStep || 1,
          onboardingDraft: user.onboardingDraft || {},
          lastActivePath: user.lastActivePath || "/dashboard",
          paypalConnected: user.paypalConnected,
          paypalSandboxPayerEmail: user.paypalSandboxPayerEmail,
        },
      },
      "Active session retrieved"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

