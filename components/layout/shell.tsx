"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Settings,
  Search,
  Bell,
  Menu,
  X,
  Layers,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useLlmConfig } from "@/lib/llm/use-llm-config";
import { providerLabels } from "@/lib/llm/types";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/proposals", label: "Proposals", icon: FileText },
  { href: "/proposals/new", label: "New Review", icon: PlusCircle },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/rulesets", label: "Rulesets", icon: Layers },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ⌘K / Ctrl+K to open search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/proposals?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
            <FileText size={18} />
          </div>
          <span className="text-lg font-bold text-text-primary">PropReview</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-accent-bg text-accent-text"
                    : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    active ? "bg-primary-600 text-white" : "bg-surface-muted text-text-tertiary group-hover:text-text-primary"
                  )}
                >
                  <Icon size={18} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 rounded-xl bg-surface-muted px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold dark:bg-primary-700 dark:text-white">
              JD
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-text-primary">John Doe</span>
              <span className="text-xs text-text-tertiary">Reviewer</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface/80 px-4 backdrop-blur-lg lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
            <span className="text-lg font-bold text-text-primary">PropReview</span>
          </div>
          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold text-text-primary">Proposal Review Workspace</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <LlmStatus />
            <Button
              variant="ghost"
              size="sm"
              className="hidden h-9 gap-2 text-text-secondary sm:flex"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
              <span className="text-xs">Search</span>
              <kbd className="hidden rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary lg:inline-block">
                ⌘K
              </kbd>
            </Button>
            <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0 text-text-secondary">
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-surface" />
            </Button>
            <ThemeToggle />
          </div>
        </header>

        {/* Mobile nav overlay */}
        {mobileOpen && (
          <div className="border-b border-border bg-surface p-4 lg:hidden">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent-bg text-accent-text"
                        : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                    )}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>

      {/* Global search command palette */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[20vh] backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSearch} className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search size={20} className="text-text-muted" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search proposals by title or client..."
                className="flex-1 bg-transparent text-base text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <kbd className="rounded border border-border bg-surface-muted px-2 py-0.5 text-xs text-text-tertiary">
                ESC
              </kbd>
            </form>
            <div className="p-2">
              <button
                type="button"
                onClick={() => {
                  router.push("/proposals");
                  setSearchOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-muted"
              >
                <FileText size={16} />
                Browse all proposals
              </button>
              <div className="px-3 py-2 text-xs font-medium text-text-muted">Suggestions</div>
              {[
                { label: "New proposal review", href: "/proposals/new", icon: PlusCircle },
                { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                { label: "Analytics", href: "/analytics", icon: BarChart3 },
                { label: "Rulesets", href: "/rulesets", icon: Layers },
                { label: "Settings", href: "/settings", icon: Settings },
              ].map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSearchOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-muted"
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LlmStatus() {
  const { config, status, testConnection } = useLlmConfig();

  useEffect(() => {
    if (status === "idle") {
      testConnection().catch(() => {});
    }
  }, [status, testConnection]);

  const statusColor =
    status === "connected"
      ? "bg-green-500"
      : status === "disconnected"
        ? "bg-red-500"
        : "bg-text-muted";

  const label = providerLabels[config.provider];

  return (
    <Link
      href="/settings"
      className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-muted sm:flex"
      title="LLM settings"
    >
      <span className={`h-2 w-2 rounded-full ${statusColor}`} />
      <span>{label}</span>
    </Link>
  );
}
