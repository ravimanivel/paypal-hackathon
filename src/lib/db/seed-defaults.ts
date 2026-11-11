import { connectDB } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { Agent } from "@/models/Agent";
import { hashPassword } from "@/lib/auth/session";
import { getOrCreateUserPolicy } from "@/services/policy.service";

let isSeeded = false;

/**
 * Ensures a controlled Administrator account exists without exposing public admin registration.
 * Also provisions default AI Shopping Agents for new users.
 */
export async function ensureControlledAdminExists() {
  if (isSeeded) return;
  try {
    await connectDB();
    const existingAdmin = await User.findOne({ role: "ADMIN" }).lean();
    if (!existingAdmin) {
      const passwordHash = await hashPassword("AdminGuard@2026!");
      await User.create({
        name: "AgentGuard Security Admin",
        email: "admin@agentguard.ai",
        passwordHash,
        role: "ADMIN",
        accountStatus: "ACTIVE",
        preferredCurrency: "INR",
        onboardingCompleted: true,
        paypalConnected: true,
      });
    }
    isSeeded = true;
  } catch {
    // Ignore seed race condition
  }
}

export async function ensureDefaultUserAgents(userId: string) {
  await connectDB();
  const existingCount = await Agent.countDocuments({ userId });
  if (existingCount > 0) return;

  await Agent.create({
    userId,
    name: "AgentGuard Shopping Concierge",
    description:
      "Primary AI shopping assistant for product discovery, price comparison, and firewall-checked purchase proposals.",
    status: "ACTIVE",
    configuration: {
      modelName: "gpt-4o-mini",
      allowedCategories: [
        "Laptops",
        "Electronics",
        "Accessories",
        "Software",
        "Office Equipment",
      ],
      paypalToolkitEnabled: true,
      directCaptureAllowed: false,
      maxProposalsPerTurn: 3,
    },
  });

  await Agent.create({
    userId,
    name: "Enterprise Procurement Scout",
    description:
      "Specialized hardware & software procurement agent bound to strict merchant allowlists.",
    status: "ACTIVE",
    configuration: {
      modelName: "gpt-4o-mini",
      allowedCategories: ["Laptops", "Office Equipment", "Software"],
      paypalToolkitEnabled: true,
      directCaptureAllowed: false,
      maxProposalsPerTurn: 2,
    },
  });

  await getOrCreateUserPolicy(userId, "INR");
}

