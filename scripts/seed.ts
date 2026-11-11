import { connectDB, getDbConnectionStatus, syncLocalStoreToMongoDB } from "../../src/lib/db/mongodb";
import {
  ensureControlledAdminExists,
  ensureDefaultUserAgents,
} from "../../src/lib/db/seed-defaults";
import { User } from "../../src/models/User";
import { Policy } from "../../src/models/Policy";
import { Agent } from "../../src/models/Agent";
import { AuditLog } from "../../src/models/AuditLog";
import { Notification } from "../../src/models/Notification";
import { hashPassword } from "../../src/lib/auth/session";

async function runSeed() {
  console.log("Connecting to AgentGuard AI database (paypal-hackathon)...");
  const conn = await connectDB();
  const status = getDbConnectionStatus();
  console.log(`✔ Database connection established: mode=${status.mode}, dbName=${status.dbName}`);

  await syncLocalStoreToMongoDB(conn);

  await ensureControlledAdminExists();
  console.log(
    "✔ Controlled Administrator ready: admin@agentguard.ai (Password: AdminGuard@2026!)"
  );

  // Also ensure a demo customer exists if needed
  const demoEmail = "demo@agentguard.ai";
  let demoUser = await User.findOne({ email: demoEmail });
  if (!demoUser) {
    demoUser = await User.create({
      name: "Ravi Demo Customer",
      email: demoEmail,
      passwordHash: await hashPassword("CustomerGuard@2026!"),
      role: "USER",
      accountStatus: "ACTIVE",
      preferredCurrency: "INR",
      onboardingCompleted: true,
      paypalConnected: true,
    });
  }

  await ensureDefaultUserAgents(String(demoUser._id));
  console.log(
    "✔ Demo Customer ready: demo@agentguard.ai (Password: CustomerGuard@2026!)"
  );

  const [usersCount, policiesCount, agentsCount, auditCount, notifCount] =
    await Promise.all([
      User.countDocuments({}),
      Policy.countDocuments({}),
      Agent.countDocuments({}),
      AuditLog.countDocuments({}),
      Notification.countDocuments({}),
    ]);

  console.log(
    `✔ Saved in MongoDB (${status.dbName}): ${usersCount} users, ${policiesCount} policies, ${agentsCount} agents, ${auditCount} audit logs, ${notifCount} notifications`
  );
  process.exit(0);
}

runSeed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});

