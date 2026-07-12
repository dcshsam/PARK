"use client";

import { useProfile } from "@/components/profile-provider";
import type { Action } from "@/lib/profiles/types";
import { roleLabels } from "@/lib/profiles/types";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

/**
 * Page-level guard. Renders children only if the active profile has the given
 * permission; otherwise shows an access-denied card. While profiles are still
 * loading it renders nothing to avoid a flash of either state.
 */
export function RequireAccess({ action, children }: { action: Action; children: React.ReactNode }) {
  const { ready, can, currentProfile } = useProfile();

  if (!ready) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-muted" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-surface-muted" />
      </div>
    );
  }

  if (!can(action)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10">
            <ShieldAlert size={24} />
          </div>
          <p className="font-semibold text-text-primary">Access restricted</p>
          <p className="max-w-md text-sm text-text-secondary">
            Your current profile{currentProfile ? ` (${roleLabels[currentProfile.role]})` : ""} does not have
            permission to view this page. Switch to an Admin profile to continue.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
