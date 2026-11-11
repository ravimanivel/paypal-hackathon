"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Shield,
  LayoutDashboard,
  Users,
  Cpu,
  ArrowLeftRight,
  AlertTriangle,
  Store,
  CreditCard,
  FileText,
  Server,
  LogOut,
  Menu,
  X,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const ADMIN_NAV_ITEMS = [
  { label: "Admin Overview", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "User Management", href: "/admin/users", icon: Users },
  { label: "AI Agent Monitoring", href: "/admin/agents", icon: Cpu },
  {
    label: "Global Transactions",
    href: "/admin/transactions",
    icon: ArrowLeftRight,
  },
  {
    label: "Fraud & Risk Monitoring",
    href: "/admin/risk",
    icon: AlertTriangle,
  },
  { label: "Merchant Management", href: "/admin/merchants", icon: Store },
  { label: "Payment Monitoring", href: "/admin/payments", icon: CreditCard },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
  { label: "System Configuration", href: "/admin/settings", icon: Server },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("agentguard_last_path", pathname);
    } catch {
      // Ignore storage error
    }
    fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastActivePath: pathname }),
    }).catch(() => {});
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Administrator signed out");
    router.push("/login");
    router.refresh();
  }

  const activeItem =
    ADMIN_NAV_ITEMS.find((i) => pathname === i.href) || ADMIN_NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#050810] text-slate-100 flex">
      {/* Desktop Admin Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-800/90 bg-[#070c17] shrink-0">
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-600">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-sm block">
                AgentGuard <span className="text-violet-400">Admin</span>
              </span>
              <span className="text-[10px] font-mono text-violet-300 uppercase">
                RBAC: ADMIN ONLY
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-violet-600/20 text-violet-200 border border-violet-500/40"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-white border border-transparent"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? "text-violet-400" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <Link
            href="/dashboard"
            className="mt-4 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Open Client Portal View</span>
          </Link>
        </nav>

        <div className="border-t border-slate-800 p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/75"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex w-72 flex-col bg-[#070c17] border-r border-slate-800 h-full p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-white">AgentGuard Admin</span>
              <button onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <nav className="space-y-1 flex-1">
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800/80 bg-[#050810]/90 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <div className="text-xs text-slate-500">
                Admin Security Console /{" "}
                <span className="text-violet-300 font-medium">
                  {activeItem.label}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-white">
                {activeItem.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle showLabel />
            <Badge variant="violet">ROLE: ADMIN</Badge>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

