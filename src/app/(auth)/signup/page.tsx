"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Shield,
  Check,
  X,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { evaluatePasswordStrength } from "@/lib/validators";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pwdStrength = useMemo(
    () => evaluatePasswordStrength(password),
    [password]
  );

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!pwdStrength.isValid) {
      setErrorMsg("Please satisfy all password security requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Password and confirm password do not match.");
      return;
    }

    if (!acceptTerms) {
      setErrorMsg("Please accept the Terms and Conditions to continue.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          confirmPassword,
          acceptTerms,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || "Registration failed");
        toast.error(data.message || "Registration failed");
        return;
      }

      toast.success("Account created! Starting your 3-step firewall setup...");
      router.push("/onboarding");
      router.refresh();
    } catch {
      setErrorMsg("Network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const strengthColors = [
    "bg-slate-800",
    "bg-rose-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-blue-500",
    "bg-emerald-500",
  ];

  const requirements = [
    { label: "Minimum 8 characters", met: pwdStrength.minLength },
    { label: "One uppercase letter (A-Z)", met: pwdStrength.hasUppercase },
    { label: "One lowercase letter (a-z)", met: pwdStrength.hasLowercase },
    { label: "One number (0-9)", met: pwdStrength.hasNumber },
    {
      label: "One special character (!@#$...)",
      met: pwdStrength.hasSpecial,
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 lg:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-white">AgentGuard AI</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-white">
        Create your AgentGuard account
      </h1>
      <p className="mt-1.5 text-sm text-slate-400">
        Set up your AI Payment Firewall and personal spending rules.
      </p>

      {errorMsg && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300"
        >
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label
            htmlFor="signup-name"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Full Name
          </label>
          <Input
            id="signup-name"
            type="text"
            placeholder="Ravi Kumar"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div>
          <label
            htmlFor="signup-email"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Email Address
          </label>
          <Input
            id="signup-email"
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
              htmlFor="signup-password"
              className="block text-xs font-medium text-slate-300"
            >
              Password
            </label>
            {password.length > 0 && (
              <span
                className={`text-[11px] font-medium ${
                  pwdStrength.score === 5
                    ? "text-emerald-400"
                    : pwdStrength.score >= 3
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                Strength: {pwdStrength.strengthLabel}
              </span>
            )}
          </div>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
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

          {/* Live 5-Segment Password Strength Meter */}
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((step) => (
              <div
                key={step}
                className={`h-1.5 rounded-full transition-colors ${
                  password.length > 0 && pwdStrength.score >= step
                    ? strengthColors[pwdStrength.score]
                    : "bg-slate-800"
                }`}
              />
            ))}
          </div>

          {/* Live Password Requirements Checklist */}
          <div className="mt-3 rounded-lg border border-slate-800/90 bg-[#090f1d] p-3">
            <p className="text-[11px] font-medium text-slate-400 mb-2">
              Mandatory Password Requirements:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {requirements.map((req) => (
                <div
                  key={req.label}
                  className={`flex items-center gap-1.5 text-xs ${
                    req.met ? "text-emerald-400" : "text-slate-500"
                  }`}
                >
                  {req.met ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <X className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                  )}
                  <span>{req.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="signup-confirm-password"
              className="block text-xs font-medium text-slate-300"
            >
              Confirm Password
            </label>
            {confirmPassword.length > 0 && (
              <span
                className={`text-[11px] ${
                  passwordsMatch ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {passwordsMatch ? "Passwords match" : "Passwords do not match"}
              </span>
            )}
          </div>
          <Input
            id="signup-confirm-password"
            type={showPassword ? "text" : "password"}
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-slate-400 leading-relaxed">
            I accept the AgentGuard AI Terms of Service, Financial Firewall
            Authorization Rules, and Privacy Policy.
          </span>
        </label>

        <Button
          type="submit"
          variant="violet"
          className="w-full mt-2"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Secure Account...
            </>
          ) : (
            <>
              Create Account & Configure Firewall
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-blue-400 hover:text-blue-300"
        >
          Sign in here
        </Link>
      </p>
    </div>
  );
}

