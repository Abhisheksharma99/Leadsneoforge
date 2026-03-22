"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Radio,
  FileText,
  FolderOpen,
  Workflow,
  ChevronLeft,
  ChevronRight,
  Zap,
  MessageSquareCode,
  Megaphone,
  Package,
  BookOpen,
  Linkedin,
  Twitter,
  Users,
  Rocket,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: string;
}

const navItems: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard, section: "main" },
  { label: "Workflow Builder", href: "/builder", icon: MessageSquareCode, section: "main" },
  { label: "Workflows", href: "/workflows", icon: Workflow, section: "main" },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone, section: "main" },
  { label: "Products", href: "/products", icon: Package, section: "main" },
  { label: "Playbook", href: "/playbook", icon: BookOpen, section: "main" },
  { label: "Reddit Monitor", href: "/reddit", icon: Radio, section: "channels" },
  { label: "LinkedIn", href: "/linkedin", icon: Linkedin, section: "channels" },
  { label: "Twitter/X", href: "/twitter", icon: Twitter, section: "channels" },
  { label: "Content Hub", href: "/content", icon: FileText, section: "channels" },
  { label: "Directories", href: "/directories", icon: FolderOpen, section: "channels" },
  { label: "Outreach Hub", href: "/outreach", icon: Users, section: "growth" },
  { label: "Growth Channels", href: "/growth", icon: Rocket, section: "growth" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  const mainItems = navItems.filter((i) => i.section === "main");
  const channelItems = navItems.filter((i) => i.section === "channels");
  const growthItems = navItems.filter((i) => i.section === "growth");

  const renderNavItem = (item: NavItem) => {
    const isActive =
      item.href === "/"
        ? pathname === "/"
        : pathname.startsWith(item.href);

    const linkContent = (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-[var(--color-forge-accent-muted)] text-[var(--color-forge-accent)]"
            : "text-[var(--color-forge-text-secondary)] hover:bg-[var(--color-forge-bg-elevated)] hover:text-[var(--color-forge-text-primary)]",
          collapsed && "justify-center px-0"
        )}
      >
        <item.icon
          className={cn(
            "h-5 w-5 shrink-0",
            isActive
              ? "text-[var(--color-forge-accent)]"
              : "text-[var(--color-forge-text-muted)]"
          )}
        />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-[var(--color-forge-bg-surface)] transition-all duration-300",
          collapsed ? "w-[68px]" : "w-60"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-forge-accent-muted)]">
            <Zap className="h-5 w-5 text-[var(--color-forge-accent)]" />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-semibold text-[var(--color-forge-text-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
                LeadsNeoForge
              </span>
              <span className="truncate text-xs text-[var(--color-forge-text-muted)]">
                Lead Gen & Automation
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {/* Main section */}
          <div className="space-y-1">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-forge-text-muted)]">
                Platform
              </p>
            )}
            {mainItems.map(renderNavItem)}
          </div>

          {/* Channels section */}
          <div className="mt-6 space-y-1">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-forge-text-muted)]">
                Channels
              </p>
            )}
            {channelItems.map(renderNavItem)}
          </div>

          {/* Growth section */}
          <div className="mt-6 space-y-1">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-forge-text-muted)]">
                Growth
              </p>
            )}
            {growthItems.map(renderNavItem)}
          </div>
        </nav>

        {/* User & controls */}
        <div className="border-t border-border p-3 space-y-2">
          {!collapsed && session?.user && (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-forge-accent-muted)] text-xs font-semibold text-[var(--color-forge-accent)]">
                {session.user.name?.[0]?.toUpperCase() || "A"}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-xs font-medium text-[var(--color-forge-text-primary)]">
                  {session.user.name || "Admin"}
                </span>
                <span className="truncate text-[10px] text-[var(--color-forge-text-muted)]">
                  {session.user.email}
                </span>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-center text-[var(--color-forge-text-muted)] hover:text-[var(--color-forge-text-primary)]"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  <span>Collapse</span>
                </>
              )}
            </Button>
            {!collapsed && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[var(--color-forge-text-muted)] hover:text-red-400"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
