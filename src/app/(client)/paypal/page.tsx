"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  Shield,
  Lock,
  CheckCircle2,
  XOctagon,
  Terminal,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton, Switch } from "@/components/ui/controls";

export default function PayPalConnectionPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paypalConnected, setPaypalConnected] = useState(false);
  const [payerEmail, setPayerEmail] = useState("");

  async function loadPayPalConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/paypal/config");
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setPaypalConnected(Boolean(data.data.userPayPalConnected));
        setPayerEmail(data.data.paypalSandboxPayerEmail || "");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayPalConfig();
  }, []);

  async function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paypalConnected,
          paypalSandboxPayerEmail: payerEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to save PayPal settings");
        return;
      }
      toast.success("PayPal Sandbox Checkout preferences updated");
      loadPayPalConfig();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-80 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">
          PayPal Sandbox & Agent Toolkit Integration
        </h2>
        <p className="text-xs text-slate-400">
          Configure PayPal Sandbox Checkout preferences and inspect the
          restricted PayPal Agent Toolkit security policy.
        </p>
      </div>

      {/* Server API Status & Architecture Clarity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-400" />
              PayPal Sandbox REST Orders v2 API
            </h3>
            <Badge variant={config?.configured ? "success" : "warning"}>
              {config?.configured
                ? "Sandbox Credentials Active"
                : "Credentials Not Configured"}
            </Badge>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Server-side OAuth 2.0 client-credentials authentication connects
            AgentGuard&apos;s backend to the PayPal Sandbox REST API (
            <code className="text-slate-200">{config?.baseUrl}</code>) to create
            and verify Checkout Orders. Note: Server OAuth authenticates the
            merchant application; customers still log in and approve each order
            in their personal PayPal Sandbox Checkout window.
          </p>

          <div className="space-y-2 border-t border-slate-800 pt-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Environment:</span>
              <span className="font-mono text-white uppercase">
                {config?.environment || "sandbox"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Webhook Verification:</span>
              <span className="font-mono text-emerald-400">
                HMAC + PayPal Verify API Enabled
              </span>
            </div>
          </div>
        </div>

        {/* PayPal Agent Toolkit Security Matrix */}
        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="h-4 w-4 text-violet-400" />
              PayPal Agent Toolkit Permission Matrix
            </h3>
            <Badge variant="violet">Zero-Trust Enforced</Badge>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            In accordance with AgentGuard&apos;s security architecture, the AI
            Shopping Agent is never granted unrestricted payment capture tools.
          </p>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#060a12] px-3 py-2">
              <span className="font-mono text-slate-300">orders.create</span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Permitted (Order Prep)
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#060a12] px-3 py-2">
              <span className="font-mono text-slate-300">orders.get</span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Permitted (Read Status)
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2">
              <span className="font-mono text-rose-200">
                pay_order / orders.capture
              </span>
              <span className="flex items-center gap-1 text-rose-400 font-bold">
                <XOctagon className="h-3.5 w-3.5" />
                FORBIDDEN FOR AI MODEL
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Checkout Preferences Form */}
      <form
        onSubmit={handleSavePreferences}
        className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" />
              Customer PayPal Checkout Preferences
            </h3>
            <p className="text-xs text-slate-400">
              Enable PayPal Sandbox Checkout for transactions that pass
              AgentGuard Firewall verification.
            </p>
          </div>
          <Switch
            checked={paypalConnected}
            onCheckedChange={setPaypalConnected}
          />
        </div>

        <div className="max-w-md">
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Reference PayPal Sandbox Buyer Email (Optional)
          </label>
          <Input
            type="email"
            placeholder="sb-buyer@personal.example.com"
            value={payerEmail}
            onChange={(e) => setPayerEmail(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            AgentGuard never asks for or stores your PayPal password.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="violet" size="sm" disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Save PayPal Preferences
          </Button>
        </div>
      </form>
    </div>
  );
}

