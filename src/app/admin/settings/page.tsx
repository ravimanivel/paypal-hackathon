"use client";

import React, { useEffect, useState } from "react";
import { Server, Shield, Database, Cpu, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/controls";

export default function AdminSystemConfigPage() {
  const [sys, setSys] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/dashboard");
        const data = await res.json();
        if (data.success) setSys(data.data.systemStatus);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Skeleton className="h-80 w-full" />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-white">
          System Configuration & Integration Health
        </h2>
        <p className="text-xs text-slate-400">
          Inspect connectivity and environment configuration status without
          exposing secret keys or credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-400" />
              MongoDB Database (`paypal-hackathon`)
            </span>
            <Badge variant={sys?.mongodbConnected ? "success" : "danger"}>
              {sys?.mongodbConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            Database Name: <code className="text-white">{sys?.mongodbDatabase}</code>{" "}
            • Engine Mode: <code className="text-white">{sys?.mongodbMode}</code>
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-sm flex items-center gap-2">
              <Cpu className="h-4 w-4 text-blue-400" />
              OpenAI Risk & Shopping Engine
            </span>
            <Badge variant={sys?.openaiConfigured ? "success" : "warning"}>
              {sys?.openaiConfigured ? "API Key Active" : "Deterministic Mode"}
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            Configured Model:{" "}
            <code className="text-white">{sys?.openaiModel}</code>
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-violet-400" />
              PayPal Sandbox Configuration
            </span>
            <Badge variant={sys?.paypalConfigured ? "success" : "warning"}>
              {sys?.paypalConfigured
                ? "Sandbox Ready"
                : "Awaiting .env.local"}
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            Endpoint: <code className="text-white">{sys?.paypalBaseUrl}</code>
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              Webhook Signature Verification
            </span>
            <Badge variant="success">Enforcing</Badge>
          </div>
          <p className="text-xs text-slate-400">
            All incoming PayPal webhooks at{" "}
            <code className="text-white">/api/paypal/webhooks</code> require
            cryptographic signature verification.
          </p>
        </div>
      </div>
    </div>
  );
}

