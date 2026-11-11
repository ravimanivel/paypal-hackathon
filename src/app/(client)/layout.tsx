"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Shield,
  LayoutDashboard,
  Bot,
  Cpu,
  Sliders,
  CheckSquare,
  ArrowLeftRight,
  AlertTriangle,
  Bell,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CurrencyCode } from "@/types";

interface ClientUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  preferredCurrency: CurrencyCode;
  onboardingCompleted: boolean;
  paypalConnected: boolean;
}

const CLIENT_NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "AI Shopping Agent", href: "/shopping-agent", icon: Bot },
  { label: "My AI Agents", href: "/agents", icon: Cpu },
  { label: "Financial Policies", href: "/policies", icon: Sliders },
  { label: "Pending Approvals", href: "/approvals", icon: CheckSquare },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { label: "Risk Intelligence", href: "/risk", icon: AlertTriangle },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "PayPal Connection", href: "/paypal", icon: CreditCard },
  { label: "Profile & Settings", href: "/settings", icon: Settings },
];

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<ClientUser | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function loadSessionAndNotifications() {
      try {
        try {
          localStorage.setItem("agentguard_last_path", pathname);
        } catch {
          // Ignore storage error
        }

        const [sessRes, notifRes] = await Promise.all([
          fetch("/api/auth/session"),
          fetch("/api/notifications"),
          fetch("/api/users/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lastActivePath: pathname }),
          }),
        ]);
        const sessData = await sessRes.json();
        if (sessData?.data?.authenticated && sessData.data.user) {
          setUser(sessData.data.user);
        }
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          setUnreadCount(notifData?.data?.unreadCount || 0);
        }
      } catch {
        // Ignore transient network errors
      }
    }
    loadSessionAndNotifications();
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out safely");
    router.push("/login");
    router.refresh();
  }

  const activeItem =
    CLIENT_NAV_ITEMS.find(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`)
    ) || CLIENT_NAV_ITEMS[0];

  const isChatMode =
    pathname === "/shopping-agent" || pathname.startsWith("/shopping-agent/");

  if (isChatMode) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#060a12] text-slate-100 flex flex-col">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100 flex">
      {/* Desktop Persistent Sidebar — Shown ONLY in Firewall Active Setting mode (hidden in dedicated Chat Mode) */}
      {!isChatMode && (
        <aside
          className={`hidden md:flex flex-col border-r border-slate-800/80 bg-[#080d19] transition-all duration-200 shrink-0 ${
            collapsed ? "w-20" : "w-64"
          }`}
        >
          <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 overflow-hidden"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 shadow-md shadow-blue-600/20">
                <Shield className="h-5 w-5 text-white" />
              </div>
              {!collapsed && (
                <div className="truncate">
                  <span className="font-bold tracking-tight text-white text-sm block">
                    AgentGuard <span className="text-blue-400">AI</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    FIREWALL ACTIVE
                  </span>
                </div>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800/70 hover:text-white cursor-pointer"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
            {CLIENT_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
                    isActive
                      ? "bg-blue-600/15 text-blue-300 border border-blue-500/30"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-blue-400" : "text-slate-400"
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!collapsed &&
                    item.href === "/notifications" &&
                    unreadCount > 0 && (
                      <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                </Link>
              );
            })}

            {user?.role === "ADMIN" && (
              <Link
                href="/admin/dashboard"
                className="mt-4 flex items-center gap-3 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 text-xs font-medium text-violet-300 hover:bg-violet-500/20"
              >
                <Lock className="h-4 w-4 shrink-0 text-violet-400" />
                {!collapsed && <span>Switch to Admin Panel</span>}
              </Link>
            )}
          </nav>

          {/* User Profile Footer */}
          <div className="border-t border-slate-800/80 p-3">
            {!collapsed && user && (
              <div className="mb-2 rounded-lg bg-[#060a12] px-3 py-2 border border-slate-800/80">
                <p className="truncate text-xs font-semibold text-white">
                  {user.name}
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  {user.email}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/30 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>
      )}

      {/* Mobile Sheet Navigation */}
      {!isChatMode && mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex w-72 flex-col bg-[#080d19] border-r border-slate-800 h-full">
            <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-white text-sm">
                  AgentGuard AI
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
              {CLIENT_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium ${
                      isActive
                        ? "bg-blue-600/15 text-blue-300 border border-blue-500/30"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
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
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header with Mode Toggle (Chat Mode UI <-> FIREWALL ACTIVE SETTING), Theme, Notifications & User Menu */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800/80 bg-[#060a12]/90 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {!isChatMode && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            {isChatMode ? (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 shadow-md shadow-blue-600/20">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="font-bold tracking-tight text-white text-sm block">
                    AgentGuard <span className="text-blue-400">AI</span>
                  </span>
                  <span className="text-[10px] text-blue-400 font-mono uppercase">
                    AI Shopping Chat Mode
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Firewall Control Center</span>
                  <span>/</span>
                  <span className="text-slate-300 font-medium">
                    {activeItem.label}
                  </span>
                </div>
                <h1 className="text-sm sm:text-base font-bold text-white">
                  {activeItem.label}
                </h1>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Primary Mode Toggle: Chat Mode UI <-> FIREWALL ACTIVE SETTING (/dashboard) */}
            <div className="flex items-center rounded-xl border border-slate-800 bg-[#080d19] p-1">
              <button
                type="button"
                onClick={() => router.push("/shopping-agent")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isChatMode
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Bot className="h-3.5 w-3.5" />
                <span>Chat Mode</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${
                  !isChatMode
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-emerald-400 hover:bg-emerald-500/15"
                }`}
                title="Open Firewall Active Settings & Security Dashboard"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <Shield className="h-3.5 w-3.5" />
                <span>FIREWALL ACTIVE SETTING</span>
              </button>
            </div>

            <ThemeToggle showLabel />

            <Badge
              variant="outline"
              className="hidden lg:inline-flex font-mono"
            >
              Currency: {user?.preferredCurrency || "INR"}
            </Badge>

            <Link
              href="/notifications"
              className="relative rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>

            <Link
              href="/settings"
              className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="font-medium truncate max-w-[110px]">
                {user?.name || "Account"}
              </span>
            </Link>

            {isChatMode && (
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/30 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

