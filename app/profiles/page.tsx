"use client";

import { useEffect, useState } from "react";
import { addProfile, deleteProfile, getProfiles, updateProfileRecord } from "@/lib/db";
import { useProfile } from "@/components/profile-provider";
import { RequireAccess } from "@/components/require-access";
import {
  type Profile,
  type Role,
  roleLabels,
  roleDescriptions,
  roleOrder,
} from "@/lib/profiles/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, ShieldCheck, UserCheck } from "lucide-react";
import { TeamMemberSettings } from "@/components/team-member-settings";

const ROLE_BADGE: Record<Role, string> = {
  admin: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  sparc_owner: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  reviewer: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  guest: "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300",
};

interface EditorState {
  id: string | null;
  name: string;
  email: string;
  role: Role;
}

export default function ProfilesPage() {
  return (
    <RequireAccess action="manage_profiles">
      <ProfilesManager />
    </RequireAccess>
  );
}

function ProfilesManager() {
  const { currentProfile, refresh } = useProfile();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState("");

  const load = () => getProfiles().then(setProfiles);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const adminCount = profiles.filter((p) => p.role === "admin").length;

  const handleSave = async () => {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    // Guard: don't allow demoting the last admin.
    if (editor.id && editor.role !== "admin") {
      const existing = profiles.find((p) => p.id === editor.id);
      if (existing?.role === "admin" && adminCount <= 1) {
        setError("At least one Admin profile must remain.");
        return;
      }
    }
    setError("");
    if (editor.id) {
      await updateProfileRecord(editor.id, { name, email: editor.email.trim(), role: editor.role });
    } else {
      await addProfile({ name, email: editor.email.trim(), role: editor.role });
    }
    setEditor(null);
    await load();
    await refresh();
  };

  const handleDelete = async (profile: Profile) => {
    if (profile.id === currentProfile?.id) {
      setError("You cannot delete the profile you are currently using.");
      return;
    }
    if (profile.role === "admin" && adminCount <= 1) {
      setError("At least one Admin profile must remain.");
      return;
    }
    setError("");
    await deleteProfile(profile.id);
    await load();
    await refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary sm:text-3xl">
            <ShieldCheck size={26} className="text-primary-600" /> Profiles &amp; Roles
          </h1>
          <p className="text-text-secondary">Create profiles and assign roles. Admins manage everything.</p>
        </div>
        <Button onClick={() => setEditor({ id: null, name: "", email: "", role: "reviewer" })}>
          <Plus size={16} className="mr-2" /> New profile
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10">
          {error}
        </div>
      )}

      {/* Role reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roles</CardTitle>
          <CardDescription>What each role can do.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {roleOrder.map((role) => (
            <div key={role} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3">
              <span className={cn("mt-0.5 rounded-md px-2 py-0.5 text-xs font-semibold", ROLE_BADGE[role])}>
                {roleLabels[role]}
              </span>
              <p className="text-xs text-text-secondary">{roleDescriptions[role]}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Profiles list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All profiles ({profiles.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <div className="h-16 animate-pulse rounded-lg bg-surface-muted" />
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {profiles.map((p) => {
                const initials = p.name
                  .split(" ")
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const isCurrent = p.id === currentProfile?.id;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-700 dark:text-white">
                        {initials || "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-text-primary">{p.name}</p>
                          {isCurrent && (
                            <span className="flex items-center gap-1 text-xs text-primary-600">
                              <UserCheck size={12} /> You
                            </span>
                          )}
                        </div>
                        {p.email && <p className="truncate text-xs text-text-tertiary">{p.email}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", ROLE_BADGE[p.role])}>
                        {roleLabels[p.role]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditor({ id: p.id, name: p.name, email: p.email ?? "", role: p.role })}
                        aria-label="Edit profile"
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(p)}
                        disabled={isCurrent || (p.role === "admin" && adminCount <= 1)}
                        aria-label="Delete profile"
                      >
                        <Trash2 size={15} className="text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team members */}
      <TeamMemberSettings />

      {/* Editor dialog */}
      <Dialog open={editor !== null} onClose={() => setEditor(null)} className="max-w-md">
        {editor && (
          <div className="space-y-4">
            <div>
              <DialogTitle>{editor.id ? "Edit profile" : "New profile"}</DialogTitle>
              <DialogDescription>Assign a name and role for this profile.</DialogDescription>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="e.g. Priya Sharma" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-email">Email (optional)</Label>
              <Input id="p-email" value={editor.email} onChange={(e) => setEditor({ ...editor, email: e.target.value })} placeholder="name@company.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-role">Role</Label>
              <Select id="p-role" value={editor.role} onChange={(e) => setEditor({ ...editor, role: e.target.value as Role })}>
                {roleOrder.map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-text-tertiary">{roleDescriptions[editor.role]}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
              <Button variant="outline" onClick={() => setEditor(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>{editor.id ? "Save changes" : "Create profile"}</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
