// Client-side profile / role model and permission matrix.
//
// NOTE: this is a browser-only prototype RBAC (no server auth). It governs what
// the UI exposes for the *active* profile; it is not a security boundary.

export type Role = "admin" | "sparc_owner" | "reviewer" | "guest";

export interface Profile {
  id: string;
  name: string;
  email?: string;
  role: Role;
  createdAt: Date;
}

export const roleLabels: Record<Role, string> = {
  admin: "Admin",
  sparc_owner: "SPARC Owner",
  reviewer: "Reviewer",
  guest: "Guest",
};

export const roleDescriptions: Record<Role, string> = {
  admin: "Full access — manage profiles, rules, settings, proposals and reviews.",
  sparc_owner: "Create and manage proposals, run reviews and drive the workflow.",
  reviewer: "Run reviews and take review actions; cannot create or delete proposals.",
  guest: "Read-only access to proposals, reviews and analytics.",
};

export const roleOrder: Role[] = ["admin", "sparc_owner", "reviewer", "guest"];

export type Action =
  | "manage_profiles"
  | "manage_rules"
  | "manage_settings"
  | "create_proposal"
  | "edit_proposal"
  | "delete_proposal"
  | "run_review"
  | "workflow_action"
  | "view";

const PERMISSIONS: Record<Role, Action[]> = {
  admin: [
    "manage_profiles",
    "manage_rules",
    "manage_settings",
    "create_proposal",
    "edit_proposal",
    "delete_proposal",
    "run_review",
    "workflow_action",
    "view",
  ],
  sparc_owner: ["create_proposal", "edit_proposal", "delete_proposal", "run_review", "workflow_action", "view"],
  reviewer: ["run_review", "workflow_action", "view"],
  guest: ["view"],
};

export function roleCan(role: Role | undefined, action: Action): boolean {
  if (!role) return false;
  return PERMISSIONS[role].includes(action);
}

export const ACTIVE_PROFILE_KEY = "prop-review:active-profile";

export function getActiveProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_PROFILE_KEY);
}

export function setActiveProfileId(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_PROFILE_KEY, id);
}
