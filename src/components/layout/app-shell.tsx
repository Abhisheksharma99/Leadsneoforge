"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const isLoginPage = pathname === "/login";

  // On login page, render children directly (no sidebar)
  if (isLoginPage) {
    return <>{children}</>;
  }

  // While loading auth, show nothing
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-forge-bg-root)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-forge-accent)] border-t-transparent" />
      </div>
    );
  }

  // Not authenticated — middleware will redirect, but show nothing meanwhile
  if (!session) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pl-60 transition-all duration-300">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
