import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/layout/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentGuard AI — The AI Payment Firewall",
  description:
    "Let AI spend. You stay in control. Deterministic financial policy engine, AI risk intelligence, and PayPal Sandbox authorization firewall for autonomous shopping agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-[#060a12] text-slate-100 antialiased selection:bg-blue-500/30 selection:text-blue-200">
        <ThemeProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
