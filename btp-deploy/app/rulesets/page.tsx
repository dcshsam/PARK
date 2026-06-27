"use client";

import { RulesetManager } from "@/components/ruleset-manager";

export default function RulesetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Rulesets</h1>
        <p className="text-text-secondary">
          Configure the scoring criteria, sections, and weights used by AI proposal review.
        </p>
      </div>
      <RulesetManager />
    </div>
  );
}
