"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Request failed");
        return;
      }
      setSubmitted(true);
      toast.success("Reset request processed");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Sign In
      </Link>

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/30 mb-4">
        <KeyRound className="h-5 w-5 text-blue-400" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-white">
        Reset your password
      </h1>
      <p className="mt-1.5 text-sm text-slate-400">
        Generates a short-lived (15-minute), single-use cryptographic reset
        token.
      </p>

      {submitted ? (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Reset Request Recorded
          </div>
          <p className="mt-2 text-xs text-slate-300 leading-relaxed">
            If an account exists for <strong>{email}</strong>, a single-use
            SHA-256 reset token has been generated. Note: Outbound SMTP email
            delivery is not configured in this sandbox environment. You may
            also change your password anytime from{" "}
            <span className="text-white font-medium">Profile & Settings</span>.
          </p>
          <Link href="/login" className="mt-4 inline-block">
            <Button variant="outline" size="sm">
              Return to Sign In
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleRequest} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="reset-email"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Account Email Address
            </label>
            <Input
              id="reset-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
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
                Generating Token...
              </>
            ) : (
              "Request Single-Use Reset Token"
            )}
          </Button>
        </form>
      )}
    </div>
  );
}

