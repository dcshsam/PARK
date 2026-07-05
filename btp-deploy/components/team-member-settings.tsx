"use client";

import { useEffect, useState } from "react";
import {
  type TeamMember,
  type TeamMemberRole,
  getTeamMembers,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
  seedTeamMembers,
  TEAM_MEMBER_ROLES,
  TEAM_MEMBER_ROLE_LABELS,
} from "@/lib/team-members";
import { getTeams, type Team } from "@/lib/team-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Users, Plus, Pencil, Trash2, Phone, Mail, UserCircle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface EditorState {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: TeamMemberRole;
  team: Team;
}

const TEAM_BADGE: Record<string, string> = {
  "GTM - Go To Market": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "SPARC - SAP and NON SAP": "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Delivery: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  Enabler: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
};

function teamBadgeClass(team: string): string {
  return (
    TEAM_BADGE[team] ??
    "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300"
  );
}

function emptyEditor(): EditorState {
  return { name: "", email: "", phone: "", role: "other", team: "" };
}

export function TeamMemberSettings() {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    seedTeamMembers();
    Promise.resolve().then(() => setMembers(getTeamMembers()));
  }, []);

  const refresh = () => setMembers(getTeamMembers());

  const handleOpenAdd = () => {
    setError("");
    setEditor(emptyEditor());
  };

  const handleOpenEdit = (member: TeamMember) => {
    setError("");
    setEditor({
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      team: member.team,
    });
  };

  const handleClose = () => {
    setEditor(null);
    setError("");
  };

  const handleSave = () => {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    const team = editor.team.trim();
    if (!team) {
      setError("Team is required. Please select a team.");
      return;
    }
    const configuredTeams = getTeams();
    if (!configuredTeams.includes(team)) {
      setError("Please select a team from the configured list.");
      return;
    }

    setError("");
    if (editor.id) {
      updateTeamMember(editor.id, {
        name,
        email: editor.email.trim(),
        phone: editor.phone.trim(),
        role: editor.role,
        team,
      });
    } else {
      addTeamMember({
        name,
        email: editor.email.trim(),
        phone: editor.phone.trim(),
        role: editor.role,
        team,
      });
    }
    refresh();
    setEditor(null);
  };

  const handleDelete = (id: string) => {
    deleteTeamMember(id);
    refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users size={20} className="text-primary-600" /> Team Members
            </CardTitle>
            <CardDescription>
              Add team members with contact details, role, and team assignment.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/team-activity")}>
              <Activity size={16} className="mr-2" /> View Team Activity
            </Button>
            <Button onClick={handleOpenAdd} size="sm">
              <Plus size={16} className="mr-2" /> Add Team Member
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted/50 text-sm text-text-muted">
            <Users size={28} className="text-text-tertiary" />
            <p>No team members added yet.</p>
            <Button variant="outline" size="sm" onClick={handleOpenAdd}>
              <Plus size={16} className="mr-2" /> Add your first team member
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-12 gap-2 border-b border-border bg-surface-muted/60 px-4 py-2 text-xs font-medium uppercase text-text-tertiary">
              <div className="col-span-3 sm:col-span-3">Name</div>
              <div className="col-span-4 sm:col-span-4">Contact</div>
              <div className="col-span-2 sm:col-span-2">Role</div>
              <div className="col-span-2 sm:col-span-2">Team</div>
              <div className="col-span-1 sm:col-span-1 text-right">Actions</div>
            </div>
            <div className="divide-y divide-border-subtle">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm"
                >
                  <div className="col-span-3 sm:col-span-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-700 dark:text-white">
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() || "?"}
                      </div>
                      <span className="truncate font-medium text-text-primary">{member.name}</span>
                    </div>
                  </div>
                  <div className="col-span-4 sm:col-span-4">
                    <div className="space-y-0.5">
                      {member.email && (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                          <Mail size={12} />
                          <span className="truncate">{member.email}</span>
                        </div>
                      )}
                      {member.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                          <Phone size={12} />
                          <span className="truncate">{member.phone}</span>
                        </div>
                      )}
                      {!member.email && !member.phone && (
                        <span className="text-xs italic text-text-muted">No contact info</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                      <UserCircle size={12} />
                      {TEAM_MEMBER_ROLE_LABELS[member.role]}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <Badge className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", teamBadgeClass(member.team))}>
                      {member.team}
                    </Badge>
                  </div>
                  <div className="col-span-1 sm:col-span-1 flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(member)}
                      aria-label={`Edit ${member.name}`}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(member.id)}
                      aria-label={`Delete ${member.name}`}
                    >
                      <Trash2 size={15} className="text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={editor !== null} onClose={handleClose} className="max-w-md">
        {editor && (
          <div className="space-y-4">
            <div>
              <DialogTitle>{editor.id ? "Edit team member" : "Add team member"}</DialogTitle>
              <DialogDescription>
                Enter the team member details below. These members can be assigned to proposals.
              </DialogDescription>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tm-name">Name</Label>
              <Input
                id="tm-name"
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                placeholder="e.g. Priya Sharma"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tm-email">Email address</Label>
              <Input
                id="tm-email"
                type="email"
                value={editor.email}
                onChange={(e) => setEditor({ ...editor, email: e.target.value })}
                placeholder="name@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tm-phone">Phone number</Label>
              <Input
                id="tm-phone"
                type="tel"
                value={editor.phone}
                onChange={(e) => setEditor({ ...editor, phone: e.target.value })}
                placeholder="+1 555 123 4567"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tm-role">Role</Label>
                <Select
                  id="tm-role"
                  value={editor.role}
                  onChange={(e) => setEditor({ ...editor, role: e.target.value as TeamMemberRole })}
                >
                  {TEAM_MEMBER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {TEAM_MEMBER_ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tm-team">
                  Team <span className="text-red-500">*</span>
                </Label>
                <Select
                  id="tm-team"
                  value={editor.team}
                  onChange={(e) => setEditor({ ...editor, team: e.target.value as Team })}
                >
                  <option value="">Select a team...</option>
                  {getTeams().map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-text-muted">
                  Configure teams in Settings.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSave}>{editor.id ? "Save changes" : "Add member"}</Button>
            </div>
          </div>
        )}
      </Dialog>
    </Card>
  );
}
