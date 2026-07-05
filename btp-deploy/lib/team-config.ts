const TEAMS_KEY = "prop-review:teams";

export type Team = string;

export const DEFAULT_TEAMS: string[] = [
  "GTM - Go To Market",
  "SPARC - SAP and NON SAP",
  "Delivery",
  "Enabler",
];

export function getTeams(): string[] {
  if (typeof window === "undefined") return DEFAULT_TEAMS;
  try {
    const raw = window.localStorage.getItem(TEAMS_KEY);
    if (!raw) return DEFAULT_TEAMS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_TEAMS;
    const cleaned = parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item !== "");
    return cleaned.length > 0 ? cleaned : DEFAULT_TEAMS;
  } catch {
    return DEFAULT_TEAMS;
  }
}

export function saveTeams(teams: string[]): void {
  if (typeof window === "undefined") return;
  const cleaned = teams
    .map((t) => t.trim())
    .filter((t) => t !== "")
    .filter((t, i, arr) => arr.indexOf(t) === i);
  window.localStorage.setItem(TEAMS_KEY, JSON.stringify(cleaned));
}

export function getDefaultTeam(): string {
  const teams = getTeams();
  return teams[0] ?? DEFAULT_TEAMS[0] ?? "";
}

export function isKnownTeam(value: string): boolean {
  return getTeams().includes(value.trim());
}
