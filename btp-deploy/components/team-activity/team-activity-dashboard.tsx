"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ActivityTimelineGrid } from "./activity-timeline-grid";
import {
  getTeamActivities,
  addTeamActivity,
  updateTeamActivity,
  deleteTeamActivity,
  generateTimelineMonths,
  groupActivitiesByMember,
  getCurrentMonthStart,
  teamActivityCategoryLabels,
  formatDateRange,
  getCategoryClasses,
} from "@/lib/team-activity";
import { getTeamMembers, type TeamMember } from "@/lib/team-members";
import { getProposals } from "@/lib/db";
import type { TeamActivity, TeamActivityCategory, Proposal } from "@/lib/types";
import { ChevronLeft, ChevronRight, Users, Plus, Calendar, List, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const VISIBLE_MONTHS = 3;

function computeActivityRange(activities: TeamActivity[]): { startMonth: Date; monthCount: number } {
  if (activities.length === 0) {
    return { startMonth: getCurrentMonthStart(), monthCount: VISIBLE_MONTHS };
  }
  const minStart = new Date(Math.min(...activities.map((a) => a.startDate.getTime())));
  const maxEnd = new Date(Math.max(...activities.map((a) => a.endDate.getTime())));
  const startMonth = new Date(minStart.getFullYear(), minStart.getMonth(), 1);
  const endMonth = new Date(maxEnd.getFullYear(), maxEnd.getMonth(), 1);
  const monthCount =
    (endMonth.getFullYear() - startMonth.getFullYear()) * 12 +
    (endMonth.getMonth() - startMonth.getMonth()) +
    1;
  return { startMonth, monthCount: Math.max(monthCount, 1) };
}

const ACTIVITY_CATEGORIES: TeamActivityCategory[] = [
  "customer",
  "capability",
  "assessment",
  "idea",
  "internal",
  "other",
];

interface ActivityForm {
  memberName: string;
  title: string;
  category: TeamActivityCategory;
  startDate: string;
  endDate: string;
  notes: string;
  proposalId: string;
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextWeekInputValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function emptyForm(): ActivityForm {
  return {
    memberName: "",
    title: "",
    category: "customer",
    startDate: todayInputValue(),
    endDate: nextWeekInputValue(),
    notes: "",
    proposalId: "",
  };
}

function activityToForm(activity: TeamActivity): ActivityForm {
  return {
    memberName: activity.memberName,
    title: activity.title,
    category: activity.category,
    startDate: activity.startDate.toISOString().slice(0, 10),
    endDate: activity.endDate.toISOString().slice(0, 10),
    notes: activity.notes ?? "",
    proposalId: activity.proposalId ?? "",
  };
}

export function TeamActivityDashboard() {
  const [activities, setActivities] = useState<TeamActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [navOffsetMonths, setNavOffsetMonths] = useState(0);
  const [filter, setFilter] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [managerOpen, setManagerOpen] = useState(false);
  const [form, setForm] = useState<ActivityForm>(emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadActivities = async () => {
    const data = await getTeamActivities();
    setActivities(data);
  };

  const activityRangeStart = useMemo(() => {
    if (activities.length === 0) return getCurrentMonthStart();
    const { startMonth } = computeActivityRange(activities);
    return startMonth;
  }, [activities]);

  const startMonth = useMemo(
    () => new Date(activityRangeStart.getFullYear(), activityRangeStart.getMonth() + navOffsetMonths, 1),
    [activityRangeStart, navOffsetMonths]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTeamActivities(), getTeamMembers(), getProposals()])
      .then(([activitiesData, members, proposalsList]) => {
        if (cancelled) return;
        setActivities(activitiesData);
        setTeamMembers(members);
        setProposals(proposalsList);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const monthCount = useMemo(() => {
    if (activities.length === 0) return VISIBLE_MONTHS;
    const maxEnd = new Date(Math.max(...activities.map((a) => a.endDate.getTime())));
    const endMonth = new Date(maxEnd.getFullYear(), maxEnd.getMonth(), 1);
    const count =
      (endMonth.getFullYear() - startMonth.getFullYear()) * 12 +
      (endMonth.getMonth() - startMonth.getMonth()) +
      1;
    return Math.max(count, 1);
  }, [activities, startMonth]);

  const months = useMemo(
    () => generateTimelineMonths(startMonth, monthCount),
    [startMonth, monthCount]
  );

  const filteredActivities = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter(
      (a) =>
        a.memberName.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [activities, filter]);

  const members = useMemo(
    () => groupActivitiesByMember(filteredActivities),
    [filteredActivities]
  );

  const sortedAllActivities = useMemo(() => {
    return [...activities].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [activities]);

  const proposalTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    proposals.forEach((p) => map.set(p.id, p.title));
    return map;
  }, [proposals]);

  const handlePrev = () => {
    setNavOffsetMonths((prev) => prev - 1);
  };

  const handleNext = () => {
    setNavOffsetMonths((prev) => prev + 1);
  };

  const handleToday = () => {
    setNavOffsetMonths(0);
  };

  const handleOpenAdd = () => {
    setError("");
    setEditingId(undefined);
    setForm(emptyForm());
    setEditorOpen(true);
  };

  const handleOpenEdit = (activity: TeamActivity) => {
    setError("");
    setEditingId(activity.id);
    setForm(activityToForm(activity));
    setManagerOpen(false);
    setEditorOpen(true);
  };

  const handleClose = () => {
    setEditorOpen(false);
    setEditingId(undefined);
    setError("");
  };

  const handleSave = async () => {
    setError("");
    if (!form.memberName.trim()) {
      setError("Please select a team member.");
      return;
    }
    if (!form.title.trim()) {
      setError("Activity title is required.");
      return;
    }

    const startDate = new Date(form.startDate);
    const endDate = new Date(form.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setError("Please enter valid start and end dates.");
      return;
    }
    if (endDate < startDate) {
      setError("End date cannot be earlier than start date.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        memberName: form.memberName.trim(),
        title: form.title.trim(),
        category: form.category,
        startDate,
        endDate,
        notes: form.notes.trim() || undefined,
        proposalId: form.proposalId || undefined,
      };
      if (editingId) {
        await updateTeamActivity(editingId, payload);
      } else {
        await addTeamActivity(payload);
      }
      await loadActivities();
      setEditorOpen(false);
      setEditingId(undefined);
      setForm(emptyForm());
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (activity: TeamActivity) => {
    if (!confirm(`Delete activity "${activity.title}" for ${activity.memberName}?`)) return;
    await deleteTeamActivity(activity.id);
    await loadActivities();
  };

  const rangeLabel = useMemo(() => {
    if (months.length === 0) return "";
    const first = months[0].label;
    const last = months[months.length - 1].label;
    return first === last ? first : `${first} – ${last}`;
  }, [months]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary">
            <Users className="h-7 w-7 text-primary-600" />
            Team Activity Dashboard
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Current team workload and planned activities by week.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePrev} aria-label="Previous month">
            <ChevronLeft size={18} />
          </Button>
          <span className="min-w-[8rem] text-center text-sm font-medium text-text-primary">
            {rangeLabel}
          </span>
          <Button variant="ghost" size="sm" onClick={handleNext} aria-label="Next month">
            <ChevronRight size={18} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setManagerOpen(true)}>
            <List size={16} className="mr-1" /> All Activities
          </Button>
          <Button onClick={handleOpenAdd} size="sm">
            <Plus size={16} className="mr-1" /> Add activity
          </Button>
        </div>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Activity Timeline</CardTitle>
            <Input
              placeholder="Filter by member or activity..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-sm text-text-muted">
              Loading team activities…
            </div>
          ) : members.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-text-muted">
              <Users size={32} className="text-text-tertiary" />
              <p>No team activities found.</p>
              {filter && <p className="text-xs">Try adjusting your filter.</p>}
              {!filter && teamMembers.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleOpenAdd}>
                  <Plus size={16} className="mr-1" /> Add the first activity
                </Button>
              )}
            </div>
          ) : (
            <ActivityTimelineGrid months={months} members={members} />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
        <span className="font-medium">Categories:</span>
        {[
          { label: "Customer", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
          { label: "Capability", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
          { label: "Assessment", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
          { label: "Idea", className: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
          { label: "Internal", className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
          { label: "Other", className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
        ].map((item) => (
          <span
            key={item.label}
            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${item.className}`}
          >
            {item.label}
          </span>
        ))}
      </div>

      {/* Add / Edit activity dialog */}
      <Dialog open={editorOpen} onClose={handleClose} className="max-w-lg">
        <div className="space-y-4">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <Calendar size={18} /> {editingId ? "Edit team activity" : "Add team activity"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the activity details below. The timeline will refresh automatically."
                : "Record an activity for a team member. It will appear on the timeline."}
            </DialogDescription>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ta-member">Team Member</Label>
            <Select
              id="ta-member"
              value={form.memberName}
              onChange={(e) => setForm({ ...form, memberName: e.target.value })}
              disabled={teamMembers.length === 0}
            >
              <option value="">{teamMembers.length === 0 ? "No team members" : "Select a team member..."}</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.name}>
                  {member.name} ({member.team})
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ta-title">Activity Title</Label>
            <Input
              id="ta-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. RFP review workshop"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ta-category">Category</Label>
            <Select
              id="ta-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as TeamActivityCategory })}
            >
              {ACTIVITY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {teamActivityCategoryLabels[category]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ta-start">Start Date</Label>
              <Input
                id="ta-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ta-end">End Date</Label>
              <Input
                id="ta-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ta-proposal">Link to Proposal (optional)</Label>
            <Select
              id="ta-proposal"
              value={form.proposalId}
              onChange={(e) => setForm({ ...form, proposalId: e.target.value })}
            >
              <option value="">None</option>
              {proposals.map((proposal) => (
                <option key={proposal.id} value={proposal.id}>
                  {proposal.title}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ta-notes">Notes (optional)</Label>
            <Textarea
              id="ta-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Add any details..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
            <Button variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || teamMembers.length === 0}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Add activity"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* All activities table dialog */}
      <Dialog open={managerOpen} onClose={() => setManagerOpen(false)} className="max-w-5xl">
        <div className="space-y-4">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <List size={18} /> All Team Activities
            </DialogTitle>
            <DialogDescription>
              View, edit, or delete every team activity. Changes are reflected on the timeline.
            </DialogDescription>
          </div>

          {activities.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted/50 text-sm text-text-muted">
              <Calendar size={28} className="text-text-tertiary" />
              <p>No activities yet.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setManagerOpen(false);
                  handleOpenAdd();
                }}
              >
                <Plus size={16} className="mr-1" /> Add activity
              </Button>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface-muted">
                  <tr className="border-b border-border text-left text-xs font-medium uppercase text-text-tertiary">
                    <th className="px-4 py-2">Member</th>
                    <th className="px-4 py-2">Title</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Dates</th>
                    <th className="px-4 py-2">Proposal</th>
                    <th className="px-4 py-2">Notes</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {sortedAllActivities.map((activity) => {
                    const classes = getCategoryClasses(activity.category);
                    return (
                      <tr key={activity.id} className="hover:bg-surface-muted/50">
                        <td className="px-4 py-2 font-medium text-text-primary">{activity.memberName}</td>
                        <td className="px-4 py-2 text-text-secondary">{activity.title}</td>
                        <td className="px-4 py-2">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", classes.badge)}>
                            {teamActivityCategoryLabels[activity.category]}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-text-secondary">
                          {formatDateRange(activity.startDate, activity.endDate)}
                        </td>
                        <td className="px-4 py-2 text-text-secondary">
                          {activity.proposalId ? (
                            <span className="max-w-[12rem] truncate" title={proposalTitleMap.get(activity.proposalId) ?? "Unknown proposal"}>
                              {proposalTitleMap.get(activity.proposalId) ?? "Unknown proposal"}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-text-secondary">
                          {activity.notes ? (
                            <span className="max-w-[16rem] truncate" title={activity.notes}>
                              {activity.notes}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(activity)}
                              aria-label={`Edit ${activity.title}`}
                            >
                              <Pencil size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(activity)}
                              aria-label={`Delete ${activity.title}`}
                            >
                              <Trash2 size={15} className="text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end border-t border-border-subtle pt-4">
            <Button variant="outline" onClick={() => setManagerOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
