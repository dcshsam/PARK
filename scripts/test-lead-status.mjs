// Check deriveLeadStatus: the lead card / dashboard / analytics all read the
// status this returns. Run: node scripts/test-lead-status.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// lead-events.ts is plain TS with no imports at runtime — strip the type import
// and the type annotations so node can eval it directly.
const src = readFileSync(new URL("../lib/lead-events.ts", import.meta.url), "utf8")
  .replace(/^import type .*$/m, "")
  .replace(/: LeadStatus|: number|: Record<LeadStatus, string>/g, "")
  .replace(/ as const/g, "");
const { deriveLeadStatus } = await import(
  "data:text/javascript," + encodeURIComponent(src)
);

// Events 1-2: still a new lead.
assert.equal(deriveLeadStatus("new", 1), "new");
assert.equal(deriveLeadStatus("new", 2), "new");
// Event 2 saved (pre-qualification done) -> qualified through due diligence.
assert.equal(deriveLeadStatus("new", 3), "qualified");
assert.equal(deriveLeadStatus("new", 4), "qualified");
// Event 5+: proposal created and under review. This is the bug that was reported —
// a lead on Event 5 used to still read "new".
assert.equal(deriveLeadStatus("new", 5), "proposal");
assert.equal(deriveLeadStatus("new", 8), "proposal");
// Explicit states win over the derived one: retro outcome and manual parking.
assert.equal(deriveLeadStatus("converted", 8), "converted");
assert.equal(deriveLeadStatus("dropped", 3), "dropped");
assert.equal(deriveLeadStatus("on_hold", 6), "on_hold");

console.log("deriveLeadStatus: all checks passed");
