import { TEAM } from "@/data/aboutData";

/** Fill both of these in one place. They stay visibly marked as placeholders. */
export const CONTACT_PLACEHOLDERS = {
  inquiry: "PLACEHOLDER · project email",
  richardEmail: "PLACEHOLDER · email",
  focus: "PLACEHOLDER",
  github: "PLACEHOLDER",
} as const;

export type ContactIcon = "github" | "link";

export interface ContactMember {
  readonly name: string;
  readonly role: string;
  readonly image: string;
  readonly email: string;
  readonly emailIsPlaceholder: boolean;
  readonly github: string;
  readonly githubIsPlaceholder: boolean;
  readonly icon: ContactIcon;
  readonly wave: number;
  readonly aiGenerated: boolean;
}

/**
 * Names, roles, and portraits come from the About team. GitHub handles are
 * not on that type, so the approved contact prototype is the source for them.
 * Richard's address and the project inbox stay in CONTACT_PLACEHOLDERS.
 */
const DETAILS: readonly Omit<ContactMember, "name" | "role" | "image">[] = [
  { email: CONTACT_PLACEHOLDERS.richardEmail, emailIsPlaceholder: true, github: "acheronx0577", githubIsPlaceholder: false, icon: "github", wave: 2, aiGenerated: false },
  { email: "erinsur@outlook.com", emailIsPlaceholder: false, github: "erinsur", githubIsPlaceholder: false, icon: "github", wave: 3, aiGenerated: false },
  { email: "phamquocthang1608@gmail.com", emailIsPlaceholder: false, github: CONTACT_PLACEHOLDERS.github, githubIsPlaceholder: true, icon: "link", wave: 1.5, aiGenerated: false },
  { email: "ryanwang2689@gmail.com", emailIsPlaceholder: false, github: CONTACT_PLACEHOLDERS.github, githubIsPlaceholder: true, icon: "link", wave: 4, aiGenerated: false },
  { email: "aqila.nasiry@gmail.com", emailIsPlaceholder: false, github: "Devcode5", githubIsPlaceholder: false, icon: "github", wave: 2.5, aiGenerated: false },
  { email: "itemuulel0140@gmail.com", emailIsPlaceholder: false, github: "irmuunt29", githubIsPlaceholder: false, icon: "github", wave: 3.5, aiGenerated: true },
];

export const CONTACT_MEMBERS: readonly ContactMember[] = TEAM.map((member, index) => {
  const detail = DETAILS[index];
  if (!detail || !member.role || !member.image) {
    throw new Error(`Contact member ${index} is missing team data`);
  }
  return { name: member.name, role: member.role, image: member.image, ...detail };
});

export const CONTACT_COUNT = CONTACT_MEMBERS.length;

/** Quoc is the resting card, matching the approved prototype. */
export const CONTACT_REST_INDEX = 2;
