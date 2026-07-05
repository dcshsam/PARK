"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigListEditor } from "@/components/config-list-editor";
import { DEFAULT_TEAMS, getTeams, saveTeams } from "@/lib/team-config";
import { RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TeamSettings() {
  const [teams, setTeams] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_TEAMS : getTeams()
  );

  const handleTeamsChange = (items: string[]) => {
    setTeams(items);
    saveTeams(items);
  };

  const handleReset = () => {
    saveTeams(DEFAULT_TEAMS);
    setTeams(DEFAULT_TEAMS);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users size={20} className="text-primary-600" /> Teams
        </CardTitle>
        <CardDescription>
          Configure the teams available when assigning team members.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ConfigListEditor
          title="Team Names"
          description="Every team member must belong to at least one configured team."
          items={teams}
          onChange={handleTeamsChange}
          placeholder="e.g. GTM - Go To Market"
          addLabel="Add Team"
        />

        <Button variant="outline" size="sm" onClick={handleReset} className="w-full sm:w-auto">
          <RotateCcw size={16} className="mr-2" />
          Reset Defaults
        </Button>
      </CardContent>
    </Card>
  );
}
