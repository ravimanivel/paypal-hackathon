"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/controls";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.success) setNotifications(data.data.notifications || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    toast.success("All notifications marked as read");
    loadNotifications();
  }

  if (loading) {
    return <Skeleton className="h-80 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            Security & Transaction Notifications
          </h2>
          <p className="text-xs text-slate-400">
            Real-time alerts from the AgentGuard Firewall, Approval Center, and
            PayPal Webhooks.
          </p>
        </div>

        {notifications.some((n) => !n.read) && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" />
            Mark All as Read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-[#0a101d] p-12 text-center">
          <Bell className="h-8 w-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-white">
            No notifications yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 flex items-start justify-between gap-4 transition-all ${
                n.read
                  ? "border-slate-800/80 bg-[#0a101d]"
                  : "border-blue-500/40 bg-[#0a101d] ring-1 ring-blue-500/20"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      n.type === "SUCCESS"
                        ? "success"
                        : n.type === "DANGER"
                        ? "danger"
                        : n.type === "WARNING" ||
                          n.type === "APPROVAL_REQUIRED"
                        ? "warning"
                        : "default"
                    }
                  >
                    {n.type}
                  </Badge>
                  {!n.read && (
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                  )}
                  <span className="text-xs text-slate-500">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">{n.title}</h3>
                <p className="text-xs text-slate-300">{n.message}</p>
              </div>

              {n.link && (
                <Link href={n.link}>
                  <Button variant="outline" size="sm">
                    View
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

