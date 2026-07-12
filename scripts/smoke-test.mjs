import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const withScreenshots = process.env.SMOKE_SCREENSHOTS === "1";
const outputDir = join(process.cwd(), "output", "playwright");

const routes = [
  "/",
  "/dashboard",
  "/proposals",
  "/proposals/new",
  "/leads",
  "/leads/new",
  "/analytics",
  "/rules",
  "/settings",
  "/profiles",
  "/team-activity",
  "/leads/lead-001",
  "/proposals/prop-001",
  "/proposals/prop-001/roadmap",
  "/proposals/prop-001/ai-review",
  "/proposals/prop-001/documents",
];

const failures = [];

for (const route of routes) {
  const url = new URL(route, baseUrl);
  try {
    const response = await fetch(url, { redirect: "manual" });
    if (response.status < 200 || response.status >= 400) {
      failures.push(`${route} returned ${response.status}`);
    } else {
      console.log(`${response.status} ${route}`);
    }
  } catch (error) {
    failures.push(`${route} failed: ${error.message}`);
  }
}

if (withScreenshots) {
  mkdirSync(outputDir, { recursive: true });
  const screenshotRoutes = [
    ["/dashboard", "dashboard-smoke.png"],
    ["/proposals", "proposals-smoke.png"],
    ["/leads", "leads-smoke.png"],
    ["/settings", "settings-smoke.png"],
    ["/team-activity", "team-activity-smoke.png"],
    ["/team-activity", "team-activity-mobile-smoke.png", "--viewport-size", "390,844"],
  ];

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  for (const [route, filename, ...extraArgs] of screenshotRoutes) {
    const result = spawnSync(
      npx,
      [
        "--yes",
        "playwright",
        "screenshot",
        "--full-page",
        "--wait-for-timeout",
        "5000",
        ...extraArgs,
        new URL(route, baseUrl).toString(),
        join(outputDir, filename),
      ],
      { stdio: "inherit" }
    );
    if (result.status !== 0) failures.push(`screenshot failed for ${route}`);
  }
}

if (failures.length > 0) {
  console.error("\nSmoke test failures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nSmoke test passed.");
