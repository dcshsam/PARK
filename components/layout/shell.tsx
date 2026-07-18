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
  BarChart3,
  SlidersHorizontal,
  ShieldCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Users,
  List,
  PanelsTopLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useLlmConfig } from "@/lib/llm/use-llm-config";
import { providerLabels } from "@/lib/llm/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { useProfile } from "@/components/profile-provider";
import { roleLabels, type Action } from "@/lib/profiles/types";
import { SapHeroBackground } from "@/components/sap-hero-background";
import { JarvisProvider } from "@/components/jarvis/jarvis-provider";
import { JarvisButton } from "@/components/jarvis/jarvis-button";
import { JarvisPanel } from "@/components/jarvis/jarvis-panel";

const navItems: { href: string; label: string; icon: React.ElementType; action?: Action }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Proposal Master", icon: List },
  { href: "/proposals", label: "Proposal Review", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/team-activity", label: "Team Activity", icon: Users },
  { href: "/project-cards", label: "Proposal Cards", icon: PanelsTopLeft },
  { href: "/rules", label: "Rules", icon: SlidersHorizontal, action: "manage_rules" },
  { href: "/profiles", label: "Profiles", icon: ShieldCheck, action: "manage_profiles" },
  { href: "/settings", label: "Settings", icon: Settings, action: "manage_settings" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { can } = useProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedLoaded, setCollapsedLoaded] = useState(false);

  const visibleNav = navItems.filter((item) => !item.action || can(item.action));

  useEffect(() => {
    Promise.resolve().then(() => {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
      setCollapsedLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!collapsedLoaded) return;
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed, collapsedLoaded]);

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
    <JarvisProvider>
    <div className="relative isolate flex min-h-full">
      {/* App-wide animated SAP background, fixed behind all chrome and content */}
      <SapHeroBackground className="fixed inset-0 z-0" />

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "relative z-10 hidden flex-col border-r border-border/60 bg-surface/85 backdrop-blur-xl transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.5rem]" : "w-64"
        )}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[3.75rem] z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-sm transition-colors hover:bg-surface-muted hover:text-text-primary"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={cn("flex h-16 items-center gap-2 border-b border-border/60", collapsed ? "justify-center px-2" : "px-6")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
            <FileText size={18} />
          </div>
          {!collapsed && <span className="truncate text-lg font-bold text-text-primary">PropReview</span>}
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all",
                  collapsed ? "justify-center px-0" : "px-3",
                  active
                    ? "bg-accent-bg text-accent-text"
                    : "text-text-primary/80 hover:bg-surface-muted hover:text-text-primary"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                    active
                      ? "border-transparent bg-primary-600 text-white"
                      : "border-border/60 bg-surface-muted/90 text-text-secondary group-hover:text-text-primary"
                  )}
                >
                  <Icon size={18} />
                </span>
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>
        <div className={cn("border-t border-border/60 p-4", collapsed && "px-2")}>
          <ProfileSwitcher collapsed={collapsed} />
        </div>
      </aside>

      {/* Mobile header */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-surface/85 px-4 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="text-text-primary"
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
            <JarvisButton placement="inline" />
            <Button
              variant="ghost"
              size="sm"
              className="hidden h-9 gap-2 text-text-primary sm:flex"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
              <span className="text-xs">Search</span>
              <kbd className="hidden rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-text-secondary lg:inline-block">
                ⌘K
              </kbd>
            </Button>
            <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0 text-text-primary">
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-surface" />
            </Button>
            <ThemeToggle className="text-text-primary" />
          </div>
        </header>

        {/* Mobile nav overlay */}
        {mobileOpen && (
          <div className="border-b border-border/60 bg-surface/80 p-4 backdrop-blur-xl lg:hidden">
            <nav className="space-y-1">
              {visibleNav.map((item) => {
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
                        : "text-text-primary/80 hover:bg-surface-muted hover:text-text-primary"
                    )}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-3 border-t border-border pt-3">
              <ProfileSwitcher />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
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
                { label: "New proposal review", href: "/proposals/new", icon: PlusCircle, action: "create_proposal" as Action },
                { label: "Proposal Master", href: "/leads", icon: List },
                { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                { label: "Analytics", href: "/analytics", icon: BarChart3 },
                { label: "Team Activity", href: "/team-activity", icon: Users },
                { label: "Rules", href: "/rules", icon: SlidersHorizontal, action: "manage_rules" as Action },
                { label: "Profiles", href: "/profiles", icon: ShieldCheck, action: "manage_profiles" as Action },
                { label: "Settings", href: "/settings", icon: Settings, action: "manage_settings" as Action },
              ]
                .filter((s) => !s.action || can(s.action))
                .map(({ label, href, icon: Icon }) => (
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

      {/* Jarvis text assistant */}
      <JarvisButton />
      <JarvisPanel />
    </div>
    </JarvisProvider>
  );
}

function ProfileSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { profiles, currentProfile, setActiveProfile, can } = useProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const initials = (currentProfile?.name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? currentProfile?.name : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl bg-surface-muted text-left transition-colors hover:bg-surface-muted/70",
          collapsed ? "justify-center p-2" : "px-3 py-2.5"
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-700 dark:text-white">
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-text-primary">
                {currentProfile?.name ?? "Loading…"}
              </span>
              <span className="text-xs text-text-tertiary">
                {currentProfile ? roleLabels[currentProfile.role] : ""}
              </span>
            </div>
            <ChevronDown size={16} className={cn("ml-auto shrink-0 text-text-tertiary transition-transform", open && "rotate-180")} />
          </>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute bottom-full z-50 mb-2 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lg",
            collapsed ? "left-0 w-56" : "left-0 w-full"
          )}
        >
          <p className="px-3 py-1.5 text-xs font-medium text-text-tertiary">Switch profile</p>
          <div className="max-h-64 overflow-y-auto">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActiveProfile(p.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
              >
                <span className="truncate font-medium text-text-primary">{p.name}</span>
                <span className="ml-auto shrink-0 text-xs text-text-tertiary">{roleLabels[p.role]}</span>
                {p.id === currentProfile?.id && <Check size={14} className="shrink-0 text-primary-600" />}
              </button>
            ))}
          </div>
          {can("manage_profiles") && (
            <Link
              href="/profiles"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-2 border-t border-border px-3 py-2 text-sm font-medium text-primary-600 hover:bg-surface-muted"
            >
              <ShieldCheck size={15} /> Manage profiles
            </Link>
          )}
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
