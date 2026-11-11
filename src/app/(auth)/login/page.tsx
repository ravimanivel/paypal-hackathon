"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Shield,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || "Invalid email address or password.");
        toast.error(data.message || "Login failed");
        return;
      }

      const user = data.data?.user;
      toast.success(`Welcome back, ${user?.name || "User"}!`);

      if (user?.role === "ADMIN") {
        router.push("/admin/dashboard");
      } else if (!user?.onboardingCompleted) {
        router.push("/onboarding");
      } else {
        // Default initial login lands in Chat Mode (/shopping-agent)
        try {
          localStorage.setItem("agentguard_last_path", "/shopping-agent");
        } catch {
          // Ignore storage error
        }
        router.push("/shopping-agent");
      }
      router.refresh();
    } catch {
      setErrorMsg("Unable to reach authentication service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function fillControlledAdmin() {
    setEmail("admin@agentguard.ai");
    setPassword("AdminGuard@2026!");
    toast.info("Filled seeded Administrator credentials");
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 lg:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-white">AgentGuard AI</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-white">
        Sign in to AgentGuard AI
      </h1>
      <p className="mt-1.5 text-sm text-slate-400">
        Access your AI Payment Firewall, policies, and approval center.
      </p>

      {errorMsg && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300"
        >
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Email Address
          </label>
          <Input
            id="login-email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-slate-300"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600"
            />
            <span className="text-xs text-slate-400">
              Remember me for 7 days
            </span>
          </label>
        </div>

        <Button
          type="submit"
          variant="violet"
          className="w-full"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying Session...
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      {/* Hackathon Quick-Access Box for Seeded Admin */}
      <div className="mt-6 rounded-xl border border-slate-800/90 bg-[#090f1d] p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <KeyRound className="h-3.5 w-3.5 text-violet-400" />
            <span>Controlled Seeded Admin Account</span>
          </div>
          <button
            type="button"
            onClick={fillControlledAdmin}
            className="text-xs font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
          >
            Auto-fill Admin
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          For customers, register a new account below to experience the 3-step
          onboarding wizard and client portal.
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        New to AgentGuard AI?{" "}
        <Link
          href="/signup"
          className="font-semibold text-blue-400 hover:text-blue-300"
        >
          Create a customer account
        </Link>
      </p>
    </div>
  );
}

