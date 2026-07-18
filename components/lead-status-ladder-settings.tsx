"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { LEAD_EVENT_LABELS } from "@/lib/lead-events";
import { leadStatusLabels, type LeadStatus } from "@/lib/types";
import {
  DEFAULT_LEAD_EVENT_STATUSES,
  getLeadEventStatuses,
  saveLeadEventStatuses,
} from "@/lib/workspace-config";
import { ListOrdered, RotateCcw } from "lucide-react";

// on_hold is derived from open pause periods and converted/dropped from the
// Event 8 retro outcome, so neither is a sensible thing to pin to an event.
const SELECTABLE: LeadStatus[] = ["new", "in_progress", "qualified", "proposal"];

export function LeadStatusLadderSettings() {
  const [ladder, setLadder] = useState<LeadStatus[]>(DEFAULT_LEAD_EVENT_STATUSES);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setLadder(getLeadEventStatuses());
      setMounted(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const update = (index: number, status: LeadStatus) => {
    const next = ladder.map((s, i) => (i === index ? status : s));
    setLadder(next);
    saveLeadEventStatuses(next);
  };

  const reset = () => {
    setLadder(DEFAULT_LEAD_EVENT_STATUSES);
    saveLeadEventStatuses(DEFAULT_LEAD_EVENT_STATUSES);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListOrdered size={20} className="text-primary-600" /> Lead Status Ladder
        </CardTitle>
        <CardDescription>
          The status a lead shows once it reaches each event. A lead&apos;s status is derived from
          this, so it never goes stale. On Hold is applied automatically while an event is paused,
          and Converted / Dropped come from the Event 8 retro outcome.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {mounted ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {LEAD_EVENT_LABELS.map((label, i) => (
              <div key={label} className="space-y-1.5">
                <label
                  htmlFor={`ladder-${i}`}
                  className="text-xs font-medium uppercase text-text-tertiary"
                >
                  Event {i + 1} — {label}
                </label>
                <Select
                  id={`ladder-${i}`}
                  value={ladder[i]}
                  onChange={(e) => update(i, e.target.value as LeadStatus)}
                >
                  {SELECTABLE.map((status) => (
                    <option key={status} value={status}>
                      {leadStatusLabels[status]}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />
        )}

        <Button variant="outline" size="sm" onClick={reset} className="w-full sm:w-auto">
          <RotateCcw size={16} className="mr-2" />
          Reset Defaults
        </Button>
      </CardContent>
    </Card>
  );
}
