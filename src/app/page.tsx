import Link from "next/link";
import {
  Shield,
  Bot,
  Lock,
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  ArrowRight,
  CreditCard,
  Activity,
  Terminal,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#060a12]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-blue-600/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">
                AgentGuard <span className="text-blue-400">AI</span>
              </span>
              <span className="ml-2 hidden rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-300 sm:inline-block">
                AI Payment Firewall
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle showLabel />
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="violet" size="sm">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden py-16 sm:py-24 border-b border-slate-800/70">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
            <div className="max-w-3xl">
              <Badge variant="violet" className="mb-4">
                <Lock className="h-3.5 w-3.5" />
                Deterministic Financial Authorization for Autonomous AI Agents
              </Badge>
              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl leading-[1.1]">
                Let AI spend.{" "}
                <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  You stay in control.
                </span>
              </h1>
              <p className="mt-6 text-lg text-slate-300 leading-relaxed max-w-2xl">
                AI shopping agents can discover products, compare specs, and
                prepare purchase proposals—but{" "}
                <strong className="text-white font-semibold">
                  AgentGuard AI
                </strong>{" "}
                sits as an unbypassable financial firewall between your AI agent
                and PayPal. Hard spending caps, merchant trust rules, AI risk
                intelligence, and cryptographic human approvals determine
                whether money is allowed to move.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/signup">
                  <Button variant="violet" size="lg">
                    Launch Client Portal
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" size="lg">
                    Sign In to Dashboard
                  </Button>
                </Link>
              </div>
            </div>

            {/* Interactive Firewall Pipeline Visualizer */}
            <div className="mt-14 rounded-2xl border border-slate-800/90 bg-[#0a101d]/90 p-6 sm:p-8 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4 mb-6">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400">
                  <Terminal className="h-4 w-4 text-blue-400" />
                  AgentGuard Authorization Pipeline
                </div>
                <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Zero-Trust Server Enforcement Active
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-[#060a12] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-slate-500">
                      01 / PROPOSAL
                    </span>
                    <Bot className="h-4 w-4 text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">
                    AI Shopping Agent
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Extracts budget & specs, compares options, and prepares a
                    structured Purchase Proposal. Never holds direct payment
                    capture authority.
                  </p>
                </div>

                <div className="rounded-xl border border-blue-500/30 bg-blue-950/15 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-blue-400">
                      02 / FIREWALL
                    </span>
                    <Shield className="h-4 w-4 text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">
                    Policy & Risk Engine
                  </h3>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    Deterministic server checks enforce single-tx, daily,
                    weekly, and monthly limits, duplicate detection, merchant
                    rules, and AI Risk Score.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#060a12] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-slate-500">
                      03 / DECISION
                    </span>
                    <FileCheck2 className="h-4 w-4 text-amber-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">
                    3-State Verdict
                  </h3>
                  <div className="mt-2 space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>AUTO_APPROVED (within safe threshold)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>REQUIRES_APPROVAL (human sign-off)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-rose-400">
                      <XOctagon className="h-3.5 w-3.5 shrink-0" />
                      <span>BLOCKED (hard policy violation)</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#060a12] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-slate-500">
                      04 / SETTLEMENT
                    </span>
                    <CreditCard className="h-4 w-4 text-violet-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">
                    PayPal Sandbox Capture
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Customer approves on PayPal Checkout. Server independently
                    re-verifies policy, ownership, and exact amount before
                    capturing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Grid */}
        <section className="py-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="border-l-2 border-blue-500 pl-5">
              <div className="flex items-center gap-2 text-blue-400 text-sm font-semibold">
                <Shield className="h-4 w-4" />
                Deterministic Hard Limits
              </div>
              <h3 className="mt-2 text-lg font-bold text-white">
                AI Can Never Override Policy
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                All spending caps are calculated in integer minor currency units
                on the server with atomic spending reservations so concurrent AI
                requests cannot race past your daily limit.
              </p>
            </div>

            <div className="border-l-2 border-violet-500 pl-5">
              <div className="flex items-center gap-2 text-violet-400 text-sm font-semibold">
                <Activity className="h-4 w-4" />
                AI Risk Intelligence
              </div>
              <h3 className="mt-2 text-lg font-semibold text-white">
                Prompt Injection & Anomaly Defense
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Untrusted merchant metadata, duplicate purchase attempts,
                velocity spikes, and prompt injection instructions are scored
                0–100 and validated via Zod schemas.
              </p>
            </div>

            <div className="border-l-2 border-emerald-500 pl-5">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <Lock className="h-4 w-4" />
                PayPal Agent Toolkit + Orders v2
              </div>
              <h3 className="mt-2 text-lg font-semibold text-white">
                9-Point Server Capture Verification
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Unrestricted capture tools (`pay_order`) are stripped from the
                agent. Final capture requires verified customer session, single-use
                approval token, and PayPal order verification.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        AgentGuard AI — The AI Payment Firewall • Built with Next.js App Router,
        MongoDB, OpenAI & PayPal Sandbox
      </footer>
    </div>
  );
}

