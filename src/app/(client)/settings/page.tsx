"use client";

import React, { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { Save, Lock, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/controls";
import { CurrencyCode } from "@/types";
import { evaluatePasswordStrength } from "@/lib/validators";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [preferredCurrency, setPreferredCurrency] =
    useState<CurrencyCode>("INR");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const pwdStrength = useMemo(
    () => evaluatePasswordStrength(newPassword),
    [newPassword]
  );

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      try {
        const res = await fetch("/api/users/me");
        const data = await res.json();
        if (data.success && data.data.user) {
          setName(data.data.user.name);
          setEmail(data.data.user.email);
          setPreferredCurrency(data.data.user.preferredCurrency || "INR");
        }
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, preferredCurrency }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Update failed");
        return;
      }
      toast.success("Profile & currency preferences updated");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwdStrength.isValid) {
      toast.error("New password does not meet security requirements");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Password change failed");
        return;
      }
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-80 w-full" />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-white">
          Profile & Security Settings
        </h2>
        <p className="text-xs text-slate-400">
          Manage your account identity, preferred currency, and authentication
          credentials.
        </p>
      </div>

      <form
        onSubmit={handleSaveProfile}
        className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-6 space-y-4"
      >
        <h3 className="text-sm font-bold text-white">Account Preferences</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">
              Full Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">
              Email Address (Normalized & Verified)
            </label>
            <Input value={email} disabled />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">
              Preferred Currency
            </label>
            <select
              value={preferredCurrency}
              onChange={(e) =>
                setPreferredCurrency(e.target.value as CurrencyCode)
              }
              className="flex h-10 w-full rounded-lg border border-slate-800 bg-[#090f1d] px-3.5 py-2 text-sm text-white"
            >
              <option value="INR">INR (₹) — Indian Rupee</option>
              <option value="USD">USD ($) — US Dollar</option>
              <option value="EUR">EUR (€) — Euro</option>
              <option value="GBP">GBP (£) — British Pound</option>
            </select>
          </div>
        </div>

        <Button
          type="submit"
          variant="violet"
          size="sm"
          disabled={savingProfile}
        >
          {savingProfile ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Profile
        </Button>
      </form>

      <form
        onSubmit={handleChangePassword}
        className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-6 space-y-4"
      >
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Lock className="h-4 w-4 text-blue-400" />
          Update Password
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">
              Current Password
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">
              New Password
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
        </div>

        {newPassword.length > 0 && (
          <div className="rounded-lg border border-slate-800 bg-[#060a12] p-3 text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "8+ chars", met: pwdStrength.minLength },
              { label: "Uppercase", met: pwdStrength.hasUppercase },
              { label: "Lowercase", met: pwdStrength.hasLowercase },
              { label: "Number", met: pwdStrength.hasNumber },
              { label: "Special char", met: pwdStrength.hasSpecial },
            ].map((r) => (
              <div
                key={r.label}
                className={`flex items-center gap-1.5 ${
                  r.met ? "text-emerald-400" : "text-slate-500"
                }`}
              >
                {r.met ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                <span>{r.label}</span>
              </div>
            ))}
          </div>
        )}

        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={savingPassword}
        >
          {savingPassword ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          Change Password
        </Button>
      </form>
    </div>
  );
}

