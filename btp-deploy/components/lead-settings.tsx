"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigListEditor } from "@/components/config-list-editor";
import {
  DEFAULT_LEAD_STATUSES,
  DEFAULT_LEAD_VERTICALS,
  DEFAULT_LEAD_TYPES,
  getLeadStatuses,
  getLeadVerticals,
  getLeadTypes,
  saveLeadStatuses,
  saveLeadVerticals,
  saveLeadTypes,
} from "@/lib/workspace-config";
import { RotateCcw, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LeadSettings() {
  const [statuses, setStatuses] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_LEAD_STATUSES : getLeadStatuses()
  );
  const [verticals, setVerticals] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_LEAD_VERTICALS : getLeadVerticals()
  );
  const [types, setTypes] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_LEAD_TYPES : getLeadTypes()
  );

  const handleStatusesChange = (items: string[]) => {
    setStatuses(items);
    saveLeadStatuses(items);
  };

  const handleVerticalsChange = (items: string[]) => {
    setVerticals(items);
    saveLeadVerticals(items);
  };

  const handleTypesChange = (items: string[]) => {
    setTypes(items);
    saveLeadTypes(items);
  };

  const handleReset = () => {
    saveLeadStatuses(DEFAULT_LEAD_STATUSES);
    saveLeadVerticals(DEFAULT_LEAD_VERTICALS);
    saveLeadTypes(DEFAULT_LEAD_TYPES);
    setStatuses(DEFAULT_LEAD_STATUSES);
    setVerticals(DEFAULT_LEAD_VERTICALS);
    setTypes(DEFAULT_LEAD_TYPES);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTodo size={20} className="text-primary-600" /> Lead Configuration
        </CardTitle>
        <CardDescription>
          Configure dropdown options used in the SPARC lead intake form.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <ConfigListEditor
            title="HG Status"
            description="Status values available when creating a lead."
            items={statuses}
            onChange={handleStatusesChange}
            placeholder="e.g. Hot"
            addLabel="Add Status"
          />

          <ConfigListEditor
            title="VD Vertical"
            description="Vertical domains available when creating a lead."
            items={verticals}
            onChange={handleVerticalsChange}
            placeholder="e.g. SAP"
            addLabel="Add Vertical"
          />

          <ConfigListEditor
            title="Lead Type"
            description="Lead types available when creating a lead."
            items={types}
            onChange={handleTypesChange}
            placeholder="e.g. Solution"
            addLabel="Add Type"
          />
        </div>

        <Button variant="outline" size="sm" onClick={handleReset} className="w-full sm:w-auto">
          <RotateCcw size={16} className="mr-2" />
          Reset Defaults
        </Button>
      </CardContent>
    </Card>
  );
}
