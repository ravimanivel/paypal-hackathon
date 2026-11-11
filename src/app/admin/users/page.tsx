"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Shield, UserCheck, UserX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/controls";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadUsers(query = search) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (data.success) setUsers(data.data.users || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers("");
  }, []);

  async function handleToggleStatus(
    userId: string,
    newStatus: "ACTIVE" | "DISABLED"
  ) {
    setUpdatingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          accountStatus: newStatus,
          reason: `Administrator changed status to ${newStatus}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to update user status");
        return;
      }
      toast.success(data.message);
      loadUsers();
    } catch {
      toast.error("Network error");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">User Management</h2>
          <p className="text-xs text-slate-400">
            Search users, inspect transaction activity, and disable or
            reactivate accounts with mandatory security audit logging.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadUsers(search);
          }}
          className="flex items-center gap-2"
        >
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search className="h-4 w-4" />
            Search
          </Button>
        </form>
      </div>

      {loading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#0a101d] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#070c17] text-slate-400">
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Currency / Onboarding</th>
                  <th className="p-4 font-medium">Transaction Activity</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/40">
                    <td className="p-4">
                      <div className="font-semibold text-white">{u.name}</div>
                      <div className="text-slate-400">{u.email}</div>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={u.role === "ADMIN" ? "violet" : "outline"}
                      >
                        {u.role}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          u.accountStatus === "ACTIVE" ? "success" : "danger"
                        }
                      >
                        {u.accountStatus}
                      </Badge>
                    </td>
                    <td className="p-4 text-slate-300">
                      <span className="font-mono">{u.preferredCurrency}</span> •{" "}
                      {u.onboardingCompleted ? "Onboarded" : "Setup Pending"}
                    </td>
                    <td className="p-4 font-mono text-slate-300">
                      Total: {u.transactionStats.total} • Completed:{" "}
                      <span className="text-emerald-400">
                        {u.transactionStats.completed}
                      </span>{" "}
                      • Blocked:{" "}
                      <span className="text-rose-400">
                        {u.transactionStats.blocked}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {u.role !== "ADMIN" && (
                        <>
                          {u.accountStatus === "ACTIVE" ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={updatingId === u.id}
                              onClick={() =>
                                handleToggleStatus(u.id, "DISABLED")
                              }
                            >
                              {updatingId === u.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserX className="h-3.5 w-3.5" />
                              )}
                              Disable Account
                            </Button>
                          ) : (
                            <Button
                              variant="success"
                              size="sm"
                              disabled={updatingId === u.id}
                              onClick={() =>
                                handleToggleStatus(u.id, "ACTIVE")
                              }
                            >
                              {updatingId === u.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5" />
                              )}
                              Reactivate
                            </Button>
                          )}
                        </>
                      )}
                      {u.role === "ADMIN" && (
                        <span className="text-slate-500 inline-flex items-center gap-1">
                          <Shield className="h-3.5 w-3.5" />
                          Protected Admin
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

