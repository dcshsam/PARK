const TECHNOLOGIES_KEY = "prop-review:technologies";
const PROJECT_TYPES_KEY = "prop-review:project-types";
const SPARC_OWNERS_KEY = "prop-review:sparc-owners";
const SPARC_MENTORS_KEY = "prop-review:sparc-mentors";
const GTM_OWNERS_KEY = "prop-review:gtm-owners";
const GTM_HEADS_KEY = "prop-review:gtm-heads";
const DELIVERY_OWNERS_KEY = "prop-review:delivery-owners";
const DELIVERY_HEADS_KEY = "prop-review:delivery-heads";
const PROPOSAL_REVIEWERS_KEY = "prop-review:proposal-reviewers";
const PROPOSAL_REGIONS_KEY = "prop-review:proposal-regions";
const LEAD_STATUSES_KEY = "prop-review:lead-statuses";
const LEAD_VERTICALS_KEY = "prop-review:lead-verticals";
const LEAD_TYPES_KEY = "prop-review:lead-types";

export const DEFAULT_TECHNOLOGIES: string[] = [];

export const DEFAULT_PROJECT_TYPES: string[] = [
  "AMS",
  "Upgrade",
  "Implementation",
  "Development",
];

export const DEFAULT_SPARC_OWNERS: string[] = [];

export const DEFAULT_SPARC_MENTORS: string[] = [];

export const DEFAULT_GTM_OWNERS: string[] = [];

export const DEFAULT_GTM_HEADS: string[] = [];

export const DEFAULT_DELIVERY_OWNERS: string[] = [];
export const DEFAULT_DELIVERY_HEADS: string[] = [];

export const DEFAULT_PROPOSAL_REVIEWERS: string[] = [];

export const DEFAULT_PROPOSAL_REGIONS: string[] = [
  "North America",
  "Europe",
  "Asia Pacific",
  "Latin America",
  "Middle East & Africa",
];

export const DEFAULT_LEAD_STATUSES: string[] = ["Hot", "Warm", "Cold"];

export const DEFAULT_LEAD_VERTICALS: string[] = [
  "SAP",
  "Non-SAP",
  "Digital",
  "Cloud",
  "Data & AI",
];

export const DEFAULT_LEAD_TYPES: string[] = [
  "Solution",
  "Capability showcase",
  "Assessment",
  "Consulting",
  "Proposal",
];

function getList(key: string, defaults: string[]): string[] {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaults;
    return parsed.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  } catch {
    return defaults;
  }
}

function saveList(key: string, items: string[]): void {
  if (typeof window === "undefined") return;
  const cleaned = items
    .map((t) => t.trim())
    .filter((t) => t !== "")
    .filter((t, i, arr) => arr.indexOf(t) === i);
  window.localStorage.setItem(key, JSON.stringify(cleaned));
}

export function getTechnologies(): string[] {
  return getList(TECHNOLOGIES_KEY, DEFAULT_TECHNOLOGIES);
}

export function saveTechnologies(technologies: string[]): void {
  saveList(TECHNOLOGIES_KEY, technologies);
}

export function getProjectTypes(): string[] {
  return getList(PROJECT_TYPES_KEY, DEFAULT_PROJECT_TYPES);
}

export function saveProjectTypes(projectTypes: string[]): void {
  saveList(PROJECT_TYPES_KEY, projectTypes);
}

export function getSparcOwners(): string[] {
  return getList(SPARC_OWNERS_KEY, DEFAULT_SPARC_OWNERS);
}

export function saveSparcOwners(owners: string[]): void {
  saveList(SPARC_OWNERS_KEY, owners);
}

export function getSparcMentors(): string[] {
  return getList(SPARC_MENTORS_KEY, DEFAULT_SPARC_MENTORS);
}

export function saveSparcMentors(mentors: string[]): void {
  saveList(SPARC_MENTORS_KEY, mentors);
}

export function getGtmOwners(): string[] {
  return getList(GTM_OWNERS_KEY, DEFAULT_GTM_OWNERS);
}

export function saveGtmOwners(owners: string[]): void {
  saveList(GTM_OWNERS_KEY, owners);
}

export function getGtmHeads(): string[] {
  return getList(GTM_HEADS_KEY, DEFAULT_GTM_HEADS);
}

export function saveGtmHeads(heads: string[]): void {
  saveList(GTM_HEADS_KEY, heads);
}

export function getDeliveryOwners(): string[] {
  return getList(DELIVERY_OWNERS_KEY, DEFAULT_DELIVERY_OWNERS);
}

export function saveDeliveryOwners(owners: string[]): void {
  saveList(DELIVERY_OWNERS_KEY, owners);
}

export function getDeliveryHeads(): string[] {
  return getList(DELIVERY_HEADS_KEY, DEFAULT_DELIVERY_HEADS);
}

export function saveDeliveryHeads(heads: string[]): void {
  saveList(DELIVERY_HEADS_KEY, heads);
}

export function getProposalReviewers(): string[] {
  return getList(PROPOSAL_REVIEWERS_KEY, DEFAULT_PROPOSAL_REVIEWERS);
}

export function saveProposalReviewers(reviewers: string[]): void {
  saveList(PROPOSAL_REVIEWERS_KEY, reviewers);
}

export function getProposalRegions(): string[] {
  return getList(PROPOSAL_REGIONS_KEY, DEFAULT_PROPOSAL_REGIONS);
}

export function saveProposalRegions(regions: string[]): void {
  saveList(PROPOSAL_REGIONS_KEY, regions);
}

export function getLeadStatuses(): string[] {
  return getList(LEAD_STATUSES_KEY, DEFAULT_LEAD_STATUSES);
}

export function saveLeadStatuses(statuses: string[]): void {
  saveList(LEAD_STATUSES_KEY, statuses);
}

export function getLeadVerticals(): string[] {
  return getList(LEAD_VERTICALS_KEY, DEFAULT_LEAD_VERTICALS);
}

export function saveLeadVerticals(verticals: string[]): void {
  saveList(LEAD_VERTICALS_KEY, verticals);
}

export function getLeadTypes(): string[] {
  return getList(LEAD_TYPES_KEY, DEFAULT_LEAD_TYPES);
}

export function saveLeadTypes(types: string[]): void {
  saveList(LEAD_TYPES_KEY, types);
}
