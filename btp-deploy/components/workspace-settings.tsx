"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigListEditor } from "@/components/config-list-editor";
import {
  DEFAULT_PROJECT_TYPES,
  DEFAULT_TECHNOLOGIES,
  DEFAULT_SPARC_OWNERS,
  DEFAULT_SPARC_MENTORS,
  DEFAULT_GTM_OWNERS,
  DEFAULT_GTM_HEADS,
  DEFAULT_DELIVERY_OWNERS,
  DEFAULT_DELIVERY_HEADS,
  DEFAULT_PROPOSAL_REVIEWERS,
  DEFAULT_PROPOSAL_REGIONS,
  getProjectTypes,
  getTechnologies,
  getSparcOwners,
  getSparcMentors,
  getGtmOwners,
  getGtmHeads,
  getDeliveryOwners,
  getDeliveryHeads,
  getProposalReviewers,
  getProposalRegions,
  saveProjectTypes,
  saveTechnologies,
  saveSparcOwners,
  saveSparcMentors,
  saveGtmOwners,
  saveGtmHeads,
  saveDeliveryOwners,
  saveDeliveryHeads,
  saveProposalReviewers,
  saveProposalRegions,
} from "@/lib/workspace-config";
import { RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WorkspaceSettings() {
  const [technologies, setTechnologies] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_TECHNOLOGIES : getTechnologies()
  );
  const [projectTypes, setProjectTypes] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_PROJECT_TYPES : getProjectTypes()
  );
  const [sparcOwners, setSparcOwners] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_SPARC_OWNERS : getSparcOwners()
  );
  const [sparcMentors, setSparcMentors] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_SPARC_MENTORS : getSparcMentors()
  );
  const [gtmOwners, setGtmOwners] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_GTM_OWNERS : getGtmOwners()
  );
  const [gtmHeads, setGtmHeads] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_GTM_HEADS : getGtmHeads()
  );
  const [deliveryOwners, setDeliveryOwners] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_DELIVERY_OWNERS : getDeliveryOwners()
  );
  const [deliveryHeads, setDeliveryHeads] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_DELIVERY_HEADS : getDeliveryHeads()
  );
  const [proposalReviewers, setProposalReviewers] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_PROPOSAL_REVIEWERS : getProposalReviewers()
  );
  const [proposalRegions, setProposalRegions] = useState<string[]>(() =>
    typeof window === "undefined" ? DEFAULT_PROPOSAL_REGIONS : getProposalRegions()
  );
  const [mounted] = useState(true);

  const handleTechnologiesChange = (items: string[]) => {
    setTechnologies(items);
    saveTechnologies(items);
  };

  const handleProjectTypesChange = (items: string[]) => {
    setProjectTypes(items);
    saveProjectTypes(items);
  };

  const handleSparcOwnersChange = (items: string[]) => {
    setSparcOwners(items);
    saveSparcOwners(items);
  };

  const handleSparcMentorsChange = (items: string[]) => {
    setSparcMentors(items);
    saveSparcMentors(items);
  };

  const handleGtmOwnersChange = (items: string[]) => {
    setGtmOwners(items);
    saveGtmOwners(items);
  };

  const handleGtmHeadsChange = (items: string[]) => {
    setGtmHeads(items);
    saveGtmHeads(items);
  };

  const handleDeliveryOwnersChange = (items: string[]) => {
    setDeliveryOwners(items);
    saveDeliveryOwners(items);
  };

  const handleDeliveryHeadsChange = (items: string[]) => {
    setDeliveryHeads(items);
    saveDeliveryHeads(items);
  };

  const handleProposalReviewersChange = (items: string[]) => {
    setProposalReviewers(items);
    saveProposalReviewers(items);
  };

  const handleProposalRegionsChange = (items: string[]) => {
    setProposalRegions(items);
    saveProposalRegions(items);
  };

  const handleReset = () => {
    saveTechnologies(DEFAULT_TECHNOLOGIES);
    saveProjectTypes(DEFAULT_PROJECT_TYPES);
    saveSparcOwners(DEFAULT_SPARC_OWNERS);
    saveSparcMentors(DEFAULT_SPARC_MENTORS);
    saveGtmOwners(DEFAULT_GTM_OWNERS);
    saveGtmHeads(DEFAULT_GTM_HEADS);
    saveDeliveryOwners(DEFAULT_DELIVERY_OWNERS);
    saveDeliveryHeads(DEFAULT_DELIVERY_HEADS);
    saveProposalReviewers(DEFAULT_PROPOSAL_REVIEWERS);
    saveProposalRegions(DEFAULT_PROPOSAL_REGIONS);
    setTechnologies(DEFAULT_TECHNOLOGIES);
    setProjectTypes(DEFAULT_PROJECT_TYPES);
    setSparcOwners(DEFAULT_SPARC_OWNERS);
    setSparcMentors(DEFAULT_SPARC_MENTORS);
    setGtmOwners(DEFAULT_GTM_OWNERS);
    setGtmHeads(DEFAULT_GTM_HEADS);
    setDeliveryOwners(DEFAULT_DELIVERY_OWNERS);
    setDeliveryHeads(DEFAULT_DELIVERY_HEADS);
    setProposalReviewers(DEFAULT_PROPOSAL_REVIEWERS);
    setProposalRegions(DEFAULT_PROPOSAL_REGIONS);
  };

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 size={20} className="text-primary-600" /> Workspace Configuration
          </CardTitle>
          <CardDescription>Manage dropdown options used in proposals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 size={20} className="text-primary-600" /> Workspace Configuration
        </CardTitle>
        <CardDescription>
          Configure the options available in proposal dropdowns across the workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-8 sm:grid-cols-2">
          <ConfigListEditor
            title="Technologies"
            description="Technologies available when creating a proposal."
            items={technologies}
            onChange={handleTechnologiesChange}
            placeholder="e.g. SAP S/4HANA"
            addLabel="Add Technology"
          />

          <ConfigListEditor
            title="Project Types"
            description="Project types available when creating a proposal."
            items={projectTypes}
            onChange={handleProjectTypesChange}
            placeholder="e.g. Support"
            addLabel="Add Type"
          />

          <ConfigListEditor
            title="Sparc Owners"
            description="Sparc owners available when creating a proposal."
            items={sparcOwners}
            onChange={handleSparcOwnersChange}
            placeholder="e.g. John Doe"
            addLabel="Add Sparc Owner"
          />

          <ConfigListEditor
            title="Sparc Mentors"
            description="Sparc mentors available when creating a proposal."
            items={sparcMentors}
            onChange={handleSparcMentorsChange}
            placeholder="e.g. Jane Smith"
            addLabel="Add Sparc Mentor"
          />

          <ConfigListEditor
            title="GTM Owners"
            description="GTM owners available when creating a proposal."
            items={gtmOwners}
            onChange={handleGtmOwnersChange}
            placeholder="e.g. Global SAP"
            addLabel="Add GTM Owner"
          />

          <ConfigListEditor
            title="GTM Heads"
            description="GTM heads available in the Event 1 lead intake form."
            items={gtmHeads}
            onChange={handleGtmHeadsChange}
            placeholder="e.g. Alex Johnson"
            addLabel="Add GTM Head"
          />

          <ConfigListEditor
            title="Delivery Owners"
            description="Delivery names available in the Event 1 lead intake form."
            items={deliveryOwners}
            onChange={handleDeliveryOwnersChange}
            placeholder="e.g. Delivery Team"
            addLabel="Add Delivery Owner"
          />

          <ConfigListEditor
            title="Delivery Heads"
            description="Delivery heads available in the Event 1 lead intake form."
            items={deliveryHeads}
            onChange={handleDeliveryHeadsChange}
            placeholder="e.g. Alex Johnson"
            addLabel="Add Delivery Head"
          />

          <ConfigListEditor
            title="Proposal Reviewers"
            description="Reviewers assigned to evaluate proposals."
            items={proposalReviewers}
            onChange={handleProposalReviewersChange}
            placeholder="e.g. Alice Johnson"
            addLabel="Add Reviewer"
          />

          <ConfigListEditor
            title="Proposal Regions"
            description="Regions available when creating a proposal."
            items={proposalRegions}
            onChange={handleProposalRegionsChange}
            placeholder="e.g. North America"
            addLabel="Add Region"
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
