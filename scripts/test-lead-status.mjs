// Check deriveLeadStatus: the lead card / dashboard / analytics all read the
// status this returns. Run: node scripts/test-lead-status.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// lead-events.ts is plain TS — strip the imports and type annotations so node can
// eval it directly. The configured ladder is passed in explicitly below, so the
// workspace-config import (localStorage) is not needed here.
const src = readFileSync(new URL("../lib/lead-events.ts", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "")
  .replace(/ladder = getLeadEventStatuses\(\)/, "ladder")
  .replace(/^type PausePeriod = .*$/m, "")
  .replace(/: Record<LeadStatus, string>|: LeadStatus\[\]|: LeadStatus|: boolean|: number/g, "")
  .replace(/eventData: Record<string, unknown> \| undefined/, "eventData")
  .replace(/lead: Pick<Lead, "status" \| "currentEvent" \| "eventData">/, "lead")
  .replace(/ladder: LeadStatus\[\]/, "ladder")
  .replace(/ as \{ pausePeriods\?: PausePeriod\[\] \} \| undefined/, "")
  .replace(/ as const/g, "");
const { deriveLeadStatus } = await import("data:text/javascript," + encodeURIComponent(src));

const DEFAULT_LADDER = [
  "new",
  "in_progress",
  "qualified",
  "qualified",
  "proposal",
  "proposal",
  "proposal",
  "proposal",
];
const lead = (currentEvent, status = "new", eventData = undefined) => ({
  currentEvent,
  status,
  eventData,
});
const derive = (l, ladder = DEFAULT_LADDER) => deriveLeadStatus(l, ladder);
const pausedAt = (event) => ({
  [`event${event}`]: { pausePeriods: [{ startedAt: new Date(), reason: "waiting on client" }] },
});
const resumedAt = (event) => ({
  [`event${event}`]: { pausePeriods: [{ startedAt: new Date(), endedAt: new Date(), reason: "x" }] },
});

// Derived from the event actually reached.
assert.equal(derive(lead(1)), "new");
assert.equal(derive(lead(2)), "in_progress");
assert.equal(derive(lead(3)), "qualified");
assert.equal(derive(lead(4)), "qualified");
assert.equal(derive(lead(5)), "proposal");
assert.equal(derive(lead(8)), "proposal");

// An open pause on any event parks the lead, whatever it was stored as.
assert.equal(derive(lead(5, "new", pausedAt(5))), "on_hold");
assert.equal(derive(lead(3, "new", pausedAt(1))), "on_hold");
// A pause that was resumed does not.
assert.equal(derive(lead(5, "new", resumedAt(5))), "proposal");

// Won / lost is a real decision at the retro — it outranks everything, including
// an open pause.
assert.equal(derive(lead(8, "converted")), "converted");
assert.equal(derive(lead(3, "dropped")), "dropped");
assert.equal(derive(lead(6, "converted", pausedAt(6))), "converted");

// A custom ladder from Settings drives the result — e.g. treating due diligence
// (Event 3) as still in progress rather than qualified.
const CUSTOM = ["new", "new", "in_progress", "qualified", "proposal", "proposal", "proposal", "proposal"];
assert.equal(derive(lead(3), CUSTOM), "in_progress");
assert.equal(derive(lead(2), CUSTOM), "new");
// Pauses and explicit outcomes still outrank whatever the ladder says.
assert.equal(derive(lead(3, "new", pausedAt(3)), CUSTOM), "on_hold");
assert.equal(derive(lead(3, "dropped"), CUSTOM), "dropped");

console.log("deriveLeadStatus: all checks passed");
