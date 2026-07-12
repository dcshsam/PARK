"use client";

import { useState } from "react";
import { clearAll, exportAll } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Download, Trash2, Database, Shield, Link as LinkIcon, Users, Palette } from "lucide-react";
import { LlmSettings } from "@/components/llm-settings";
import { WorkspaceSettings } from "@/components/workspace-settings";
import { LeadSettings } from "@/components/lead-settings";
import { LeadStatusLadderSettings } from "@/components/lead-status-ladder-settings";
import { TeamSettings } from "@/components/team-settings";
import { ThemeMenu } from "@/components/theme-toggle";
import { RequireAccess } from "@/components/require-access";

export default function SettingsPage() {
  return (
    <RequireAccess action="manage_settings">
      <SettingsContent />
    </RequireAccess>
  );
}

function SettingsContent() {
  const [exporting, setExporting] = useState(false);
  const [roles, setRoles] = useState({
    admin: true,
    reviewer: true,
    viewer: false,
  });

  const handleExport = async () => {
    setExporting(true);
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposal-review-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const handleClear = async () => {
    if (confirm("This will permanently delete all proposals, documents, and comments. Continue?")) {
      await clearAll();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Admin Settings</h1>
        <p className="text-text-secondary">Configure the proposal review workspace.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={20} className="text-primary-600" /> Roles & Permissions
            </CardTitle>
            <CardDescription>Control who can create, review, and approve proposals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "admin", label: "Administrator", desc: "Full access to all features and settings." },
              { key: "reviewer", label: "Reviewer", desc: "Can score, comment, and change proposal status." },
              { key: "viewer", label: "Viewer", desc: "Read-only access to proposals and documents." },
            ].map((role) => (
              <div key={role.key} className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-surface-muted/50">
                <div>
                  <p className="text-sm font-medium text-text-primary">{role.label}</p>
                  <p className="text-xs text-text-tertiary">{role.desc}</p>
                </div>
                <Switch
                  checked={roles[role.key as keyof typeof roles]}
                  onCheckedChange={(checked) => setRoles({ ...roles, [role.key]: checked })}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={20} className="text-primary-600" /> Review Categories
            </CardTitle>
            <CardDescription>Default categories used during document intake.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {["RFP Document", "Meeting Transcript", "Customer Document"].map((label) => (
              <div key={label} className="flex items-center gap-3">
                <Input defaultValue={label} />
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full">
              Add Category
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette size={20} className="text-primary-600" /> Appearance
            </CardTitle>
            <CardDescription>Choose your preferred color theme.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeMenu />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon size={20} className="text-primary-600" /> Integrations
            </CardTitle>
            <CardDescription>Connect external data sources and services.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { title: "PostgreSQL Backend", desc: "Migrate from local IndexedDB to a server database." },
              { title: "Cloud File Storage", desc: "Store large files in S3 / MinIO instead of browser DB." },
            ].map((item) => (
              <div key={item.title} className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-surface-muted/50">
                <div>
                  <p className="text-sm font-medium text-text-primary">{item.title}</p>
                  <p className="text-xs text-text-tertiary">{item.desc}</p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Configure
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <LlmSettings />
        </div>

        <div className="lg:col-span-2">
          <LeadSettings />
        </div>

        <div className="lg:col-span-2">
          <LeadStatusLadderSettings />
        </div>

        <div className="lg:col-span-2">
          <WorkspaceSettings />
        </div>

        <div className="lg:col-span-2">
          <TeamSettings />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database size={20} className="text-primary-600" /> Data Management
            </CardTitle>
            <CardDescription>Backup or reset your local workspace data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={handleExport} disabled={exporting}>
              <Download size={18} className="mr-2" /> Export Backup JSON
            </Button>
            <Button variant="danger" className="w-full justify-start" onClick={handleClear}>
              <Trash2 size={18} className="mr-2" /> Clear All Local Data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
