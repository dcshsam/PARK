// Check deriveLeadStatus: the lead card / dashboard / analytics all read the
// status this returns. Run: node scripts/test-lead-status.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// lead-events.ts is plain TS with no runtime imports — strip the type import and
// the type annotations so node can eval it directly.
const src = readFileSync(new URL("../lib/lead-events.ts", import.meta.url), "utf8")
  .replace(/^import type .*$/m, "")
  .replace(/^type PausePeriod = .*$/m, "")
  .replace(/: Record<LeadStatus, string>|: LeadStatus\[\]|: LeadStatus|: boolean|: number/g, "")
  .replace(/eventData: Record<string, unknown> \| undefined/, "eventData")
  .replace(/lead: Pick<Lead, "status" \| "currentEvent" \| "eventData">/, "lead")
  .replace(/ as \{ pausePeriods\?: PausePeriod\[\] \} \| undefined/, "")
  .replace(/ as const/g, "");
const { deriveLeadStatus } = await import("data:text/javascript," + encodeURIComponent(src));

const lead = (currentEvent, status = "new", eventData = undefined) => ({
  currentEvent,
  status,
  eventData,
});
const pausedAt = (event) => ({
  [`event${event}`]: { pausePeriods: [{ startedAt: new Date(), reason: "waiting on client" }] },
});
const resumedAt = (event) => ({
  [`event${event}`]: { pausePeriods: [{ startedAt: new Date(), endedAt: new Date(), reason: "x" }] },
});

// Derived from the event actually reached.
assert.equal(deriveLeadStatus(lead(1)), "new");
assert.equal(deriveLeadStatus(lead(2)), "in_progress");
assert.equal(deriveLeadStatus(lead(3)), "qualified");
assert.equal(deriveLeadStatus(lead(4)), "qualified");
assert.equal(deriveLeadStatus(lead(5)), "proposal");
assert.equal(deriveLeadStatus(lead(8)), "proposal");

// An open pause on any event parks the lead, whatever it was stored as.
assert.equal(deriveLeadStatus(lead(5, "new", pausedAt(5))), "on_hold");
assert.equal(deriveLeadStatus(lead(3, "new", pausedAt(1))), "on_hold");
// A pause that was resumed does not.
assert.equal(deriveLeadStatus(lead(5, "new", resumedAt(5))), "proposal");

// Won / lost is a real decision at the retro — it outranks everything, including
// an open pause.
assert.equal(deriveLeadStatus(lead(8, "converted")), "converted");
assert.equal(deriveLeadStatus(lead(3, "dropped")), "dropped");
assert.equal(deriveLeadStatus(lead(6, "converted", pausedAt(6))), "converted");

console.log("deriveLeadStatus: all checks passed");
