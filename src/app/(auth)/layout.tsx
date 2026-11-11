import Link from "next/link";
import { Shield, Lock, CheckCircle2, Cpu } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#060a12]">
      {/* Left Security Branding Panel */}
      <div className="hidden lg:flex lg:col-span-5 flex-col justify-between border-r border-slate-800/80 bg-[#080e1a] p-10 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-blue-600/15 via-violet-600/5 to-transparent" />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-blue-600/25">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">
                AgentGuard <span className="text-blue-400">AI</span>
              </span>
              <p className="text-[11px] text-slate-400">
                The AI Payment Firewall
              </p>
            </div>
          </Link>

          <div className="mt-14">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
              <Lock className="h-3.5 w-3.5" />
              Zero-Trust Autonomous Commerce
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white leading-snug">
              Let AI spend.
              <br />
              <span className="text-blue-400">You stay in control.</span>
            </h2>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              Every purchase proposed by your AI shopping agents passes through
              deterministic spending policies, AI risk intelligence, and
              cryptographic human approval before PayPal Checkout is permitted.
            </p>
          </div>

          <div className="mt-10 space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-slate-200">
                  Deterministic Server-Side Limits
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Single-transaction, daily, weekly, and monthly caps enforced
                  atomically in minor currency units.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-slate-200">
                  Bound Single-Use Approvals
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Time-limited approvals bound to exact amount, currency,
                  merchant, and proposal ID.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Cpu className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-slate-200">
                  PayPal Agent Toolkit Sandbox Guard
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  AI models prepare proposals; backend verifies 9 security
                  invariants before payment capture.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 rounded-xl border border-slate-800/90 bg-[#060a12]/90 p-4 text-xs text-slate-400">
          <div className="flex items-center justify-between text-slate-300 font-medium mb-1">
            <span>Security Posture</span>
            <span className="text-emerald-400 font-mono">ENFORCING</span>
          </div>
          HttpOnly session cookies • Bcrypt cost-12 password hashing •
          Role-based access control
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="lg:col-span-7 flex flex-col justify-center px-4 py-10 sm:px-8 lg:px-16 relative">
        <div className="absolute right-6 top-6">
          <ThemeToggle showLabel />
        </div>
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

