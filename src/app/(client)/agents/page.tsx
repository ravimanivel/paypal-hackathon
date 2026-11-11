"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Cpu,
  Plus,
  Shield,
  Pause,
  Play,
  Ban,
  Lock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/controls";

export default function MyAgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function loadAgents() {
    setLoading(true);
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      if (data.success) setAgents(data.data.agents || []);
    } catch {
      toast.error("Failed to load AI agents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  async function handleCreateAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          allowedCategories: ["Laptops", "Electronics", "Accessories"],
          paypalToolkitEnabled: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to create agent");
        return;
      }
      toast.success("AI Agent registered under AgentGuard Firewall");
      setName("");
      setDescription("");
      setShowCreateForm(false);
      loadAgents();
    } catch {
      toast.error("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateStatus(
    agentId: string,
    status: "ACTIVE" | "PAUSED" | "REVOKED"
  ) {
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to update status");
        return;
      }
      toast.success(`Agent status updated to ${status}`);
      loadAgents();
    } catch {
      toast.error("Failed to update agent");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((n) => (
          <Skeleton key={n} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">
            Registered AI Shopping Agents
          </h2>
          <p className="text-xs text-slate-400">
            Manage autonomous shopping agents connected to your AgentGuard
            Financial Firewall. Direct payment capture is disabled on all
            agents.
          </p>
        </div>

        <Button
          variant="violet"
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <Plus className="h-4 w-4" />
          Register New AI Agent
        </Button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateAgent}
          className="rounded-xl border border-blue-500/30 bg-[#0a101d] p-5 space-y-4"
        >
          <h3 className="text-sm font-bold text-white">
            Register Autonomous Shopping Agent
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Agent Name
              </label>
              <Input
                placeholder="e.g., Cloud DevOps Hardware Buyer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Description & Mandate
              </label>
              <Input
                placeholder="e.g., Searches for developer laptops and accessories under budget"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-emerald-400 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Unrestricted `pay_order` capture authority is permanently blocked
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="violet" size="sm" disabled={creating}>
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save AI Agent"
                )}
              </Button>
            </div>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {agents.map((ag) => (
          <div
            key={ag.id}
            className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/15 border border-blue-500/30">
                    <Cpu className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{ag.name}</h3>
                    <span className="text-[11px] font-mono text-slate-500">
                      ID: {ag.id.slice(-8)} • Model:{" "}
                      {ag.configuration?.modelName || "gpt-4o-mini"}
                    </span>
                  </div>
                </div>
                <Badge
                  variant={
                    ag.status === "ACTIVE"
                      ? "success"
                      : ag.status === "PAUSED"
                      ? "warning"
                      : "danger"
                  }
                >
                  {ag.status}
                </Badge>
              </div>

              <p className="mt-3 text-xs text-slate-300 leading-relaxed">
                {ag.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {ag.configuration?.allowedCategories?.map((cat: string) => (
                  <Badge key={cat} variant="outline" className="text-[10px]">
                    {cat}
                  </Badge>
                ))}
                <Badge variant="violet" className="text-[10px]">
                  <Shield className="h-3 w-3" />
                  Direct Capture: Forbidden
                </Badge>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">
                    Proposals
                  </span>
                  <span className="font-mono font-bold text-white">
                    {ag.totalProposals}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">
                    Auto-Approved
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {ag.approvedProposals}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">
                    Blocked
                  </span>
                  <span className="font-mono font-bold text-rose-400">
                    {ag.blockedProposals}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {ag.status !== "ACTIVE" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateStatus(ag.id, "ACTIVE")}
                  >
                    <Play className="h-3.5 w-3.5 text-emerald-400" />
                    Activate
                  </Button>
                )}
                {ag.status === "ACTIVE" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateStatus(ag.id, "PAUSED")}
                  >
                    <Pause className="h-3.5 w-3.5 text-amber-400" />
                    Pause
                  </Button>
                )}
                {ag.status !== "REVOKED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateStatus(ag.id, "REVOKED")}
                  >
                    <Ban className="h-3.5 w-3.5 text-rose-400" />
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

