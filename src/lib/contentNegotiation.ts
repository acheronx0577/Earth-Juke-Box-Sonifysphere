/** Accept negotiation for text/html and text/markdown. See https://acceptmarkdown.com/recipes/nextjs */

export const PRODUCES = ["text/html", "text/markdown"] as const;

export type ProducedType = (typeof PRODUCES)[number];

type AcceptEntry = {
  type: string;
  q: number;
  specificity: number;
};

export function parseAccept(header: string): AcceptEntry[] {
  return header.split(",").map((raw) => {
    const parts = raw.trim().split(";").map((part) => part.trim()).filter(Boolean);
    const type = (parts[0] ?? "").toLowerCase();
    let q = 1;
    for (const param of parts.slice(1)) {
      const [name, value] = param.split("=").map((part) => part.trim());
      if (name === "q") {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) q = Math.max(0, Math.min(1, parsed));
      }
    }
    const specificity = type === "*/*" ? 0 : type.endsWith("/*") ? 1 : 2;
    return { type, q, specificity };
  }).filter((entry) => entry.type.length > 0);
}

function matches(entry: AcceptEntry, candidate: string): boolean {
  if (entry.type === "*/*") return true;
  if (entry.type.endsWith("/*")) return candidate.startsWith(entry.type.slice(0, -1));
  return entry.type === candidate;
}

/**
 * Highest-q type this server can produce.
 * HTML wins ties, including a wildcard and a missing Accept header.
 * Returns null when the client rejects every type we produce.
 */
export function preferredType(header: string | null): ProducedType | null {
  if (!header || header.trim() === "") return PRODUCES[0];
  const entries = parseAccept(header);
  if (entries.length === 0) return PRODUCES[0];

  let bestType: ProducedType | null = null;
  let bestQ = -1;
  let bestPosition = Infinity;

  for (const candidate of PRODUCES) {
    let matched: AcceptEntry | null = null;
    let matchedPosition = Infinity;
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (!entry || !matches(entry, candidate)) continue;
      if (
        matched === null
        || entry.specificity > matched.specificity
        || (entry.specificity === matched.specificity && index < matchedPosition)
      ) {
        matched = entry;
        matchedPosition = index;
      }
    }
    if (matched === null || matched.q <= 0) continue;
    if (matched.q > bestQ || (matched.q === bestQ && matchedPosition < bestPosition)) {
      bestQ = matched.q;
      bestPosition = matchedPosition;
      bestType = candidate;
    }
  }

  return bestType;
}

/** Document responses must vary on Accept and on Next's flight headers. */
export const DOCUMENT_VARY = "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept";

export function setDocumentVary(headers: Headers): void {
  headers.set("Vary", mergeVaryHeader(headers.get("Vary"), DOCUMENT_VARY));
}

export function appendVaryAccept(headers: Headers): void {
  const existing = headers.get("Vary");
  if (!existing) {
    headers.set("Vary", "Accept");
    return;
  }
  const tokens = existing.split(",").map((token) => token.trim().toLowerCase());
  if (!tokens.includes("accept") && !tokens.includes("*")) {
    headers.set("Vary", `${existing}, Accept`);
  }
}

export function mergeVaryHeader(existing: unknown, incoming: unknown): string {
  const tokens: string[] = [];
  const seen = new Set<string>();
  const add = (value: unknown) => {
    if (value == null) return;
    const parts = Array.isArray(value) ? value : [value];
    for (const part of parts) {
      for (const token of String(part).split(",")) {
        const trimmed = token.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tokens.push(trimmed);
      }
    }
  };
  add(existing);
  add(incoming);
  return tokens.join(", ");
}

export function varyIncludesAccept(vary: string | null): boolean {
  if (!vary) return false;
  return vary.split(",").some((token) => {
    const name = token.trim().toLowerCase();
    return name === "accept" || name === "*";
  });
}
