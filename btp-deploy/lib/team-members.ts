import { getDefaultTeam, getTeams, isKnownTeam } from "./team-config";

export type Team = string;

export type TeamMemberRole =
  | "sparc_owner"
  | "sparc_mentor"
  | "gtm_owner"
  | "proposal_reviewer"
  | "proposal_owner"
  | "proposal_contributor"
  | "admin"
  | "other";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: TeamMemberRole;
  team: Team;
}

const TEAM_MEMBERS_KEY = "prop-review:team-members";

export { getTeams, isKnownTeam };

export const DEFAULT_TEAM_MEMBERS: TeamMember[] = [
  {
    id: "tm-priya-sharma",
    name: "Priya Sharma",
    email: "priya.sharma@company.com",
    phone: "+91 98765 43210",
    role: "sparc_owner",
    team: "SPARC - SAP and NON SAP",
  },
  {
    id: "tm-arun-verma",
    name: "Arun Verma",
    email: "arun.verma@company.com",
    phone: "+91 98765 43211",
    role: "proposal_reviewer",
    team: "SPARC - SAP and NON SAP",
  },
  {
    id: "tm-sunita-rao",
    name: "Sunita Rao",
    email: "sunita.rao@company.com",
    phone: "+91 98765 43212",
    role: "gtm_owner",
    team: "GTM - Go To Market",
  },
  {
    id: "tm-rahul-mehta",
    name: "Rahul Mehta",
    email: "rahul.mehta@company.com",
    phone: "+91 98765 43213",
    role: "sparc_mentor",
    team: "SPARC - SAP and NON SAP",
  },
  {
    id: "tm-anjali-gupta",
    name: "Anjali Gupta",
    email: "anjali.gupta@company.com",
    phone: "+91 98765 43214",
    role: "proposal_owner",
    team: "Delivery",
  },
  {
    id: "tm-vikram-joshi",
    name: "Vikram Joshi",
    email: "vikram.joshi@company.com",
    phone: "+91 98765 43215",
    role: "proposal_contributor",
    team: "Delivery",
  },
  {
    id: "tm-deepa-nair",
    name: "Deepa Nair",
    email: "deepa.nair@company.com",
    phone: "+91 98765 43216",
    role: "admin",
    team: "Enabler",
  },
  {
    id: "tm-karan-patel",
    name: "Karan Patel",
    email: "karan.patel@company.com",
    phone: "+91 98765 43217",
    role: "proposal_reviewer",
    team: "Enabler",
  },
];

export const TEAM_MEMBER_ROLES: TeamMemberRole[] = [
  "sparc_owner",
  "sparc_mentor",
  "gtm_owner",
  "proposal_reviewer",
  "proposal_owner",
  "proposal_contributor",
  "admin",
  "other",
];

export const TEAM_MEMBER_ROLE_LABELS: Record<TeamMemberRole, string> = {
  sparc_owner: "SPARC Owner",
  sparc_mentor: "SPARC Mentor",
  gtm_owner: "GTM Owner",
  proposal_reviewer: "Proposal Reviewer",
  proposal_owner: "Proposal Owner",
  proposal_contributor: "Proposal Contributor",
  admin: "Administrator",
  other: "Other",
};

function isTeamMemberRole(value: string): value is TeamMemberRole {
  return TEAM_MEMBER_ROLES.includes(value as TeamMemberRole);
}

function normalizeTeam(value: string): Team {
  const trimmed = value.trim();
  if (!trimmed) return getDefaultTeam();
  if (isKnownTeam(trimmed)) return trimmed;
  const teams = getTeams();
  return teams[0] ?? getDefaultTeam();
}

function sanitize(member: TeamMember): TeamMember {
  return {
    ...member,
    name: member.name.trim(),
    email: member.email.trim(),
    phone: member.phone.trim(),
    role: isTeamMemberRole(member.role) ? member.role : "other",
    team: normalizeTeam(member.team),
  };
}

export function getTeamMembers(): TeamMember[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TEAM_MEMBERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): TeamMember | null => {
        if (!item || typeof item !== "object") return null;
        const m = item as Record<string, unknown>;
        if (typeof m.name !== "string" || !m.name.trim()) return null;
        return sanitize({
          id: typeof m.id === "string" ? m.id : crypto.randomUUID(),
          name: m.name,
          email: typeof m.email === "string" ? m.email : "",
          phone: typeof m.phone === "string" ? m.phone : "",
          role: typeof m.role === "string" ? (m.role as TeamMemberRole) : "other",
          team: typeof m.team === "string" ? normalizeTeam(m.team) : getDefaultTeam(),
        });
      })
      .filter((m): m is TeamMember => m !== null);
  } catch {
    return [];
  }
}

export function saveTeamMembers(members: TeamMember[]): void {
  if (typeof window === "undefined") return;
  const cleaned = members
    .map(sanitize)
    .filter((m) => m.name !== "")
    .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
  window.localStorage.setItem(TEAM_MEMBERS_KEY, JSON.stringify(cleaned));
}

export function addTeamMember(input: Omit<TeamMember, "id">): TeamMember {
  const members = getTeamMembers();
  const member: TeamMember = { ...sanitize({ ...input, id: "" }), id: crypto.randomUUID() };
  saveTeamMembers([...members, member]);
  return member;
}

export function updateTeamMember(id: string, changes: Partial<Omit<TeamMember, "id">>): TeamMember | undefined {
  const members = getTeamMembers();
  const index = members.findIndex((m) => m.id === id);
  if (index === -1) return undefined;
  const updated = sanitize({ ...members[index], ...changes });
  members[index] = updated;
  saveTeamMembers(members);
  return updated;
}

export function deleteTeamMember(id: string): void {
  const members = getTeamMembers();
  saveTeamMembers(members.filter((m) => m.id !== id));
}

export function getTeamMemberNames(): string[] {
  return getTeamMembers().map((m) => m.name);
}

export function getTeamMembersByRole(role: TeamMemberRole): TeamMember[] {
  return getTeamMembers().filter((m) => m.role === role);
}

export function getTeamMemberNamesByRole(role: TeamMemberRole): string[] {
  return getTeamMembersByRole(role).map((m) => m.name);
}

export function getTeamMembersByTeam(team: Team): TeamMember[] {
  return getTeamMembers().filter((m) => m.team === team);
}

export function getTeamMemberById(id: string): TeamMember | undefined {
  return getTeamMembers().find((m) => m.id === id);
}

/** Seed default team members once if none have been saved yet. */
export function seedTeamMembers(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(TEAM_MEMBERS_KEY)) return;
  saveTeamMembers(DEFAULT_TEAM_MEMBERS);
}

/** Merge a workspace-configured name list with team members assigned to a role, deduping by name. */
export function combineAssignableNames(
  workspaceNames: string[],
  role: TeamMemberRole,
  members: TeamMember[]
): { name: string; team?: string }[] {
  const map = new Map<string, string | undefined>();
  workspaceNames.forEach((n) => map.set(n, undefined));
  members
    .filter((m) => m.role === role)
    .forEach((m) => map.set(m.name, m.team));
  return Array.from(map.entries()).map(([name, team]) => ({ name, team }));
}
