import { isMarkdownPath, type MarkdownPath } from "./agentCopy";
import { preferredType } from "./contentNegotiation";

/** Pages that exist. A markdown request for anything else is a 404, not HTML. */
const PAGES = new Set<string>([
  "/",
  "/about",
  "/listen",
  "/listen/classic",
  "/listen/colormap",
  "/listen/epic",
  "/listen/events",
  "/challenge",
  "/challenge/compose",
  "/challenge/guess",
  "/challenge/match",
  "/challenge/ribbon",
  "/challenge/ribbons",
  "/contact",
  "/privacy",
  "/story",
]);

export type NegotiationDecision =
  | { kind: "skip" }
  | { kind: "passthrough" }
  | { kind: "markdown"; pathname: MarkdownPath }
  | { kind: "not-acceptable" }
  | { kind: "markdown-not-found" };

export function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return normalizePathname(pathname.slice(0, -1));
  return pathname;
}

function isRedirectSource(pathname: string): boolean {
  return pathname === "/credits"
    || pathname === "/credit"
    || pathname === "/play"
    || pathname.startsWith("/play/")
    || pathname === "/challenges"
    || pathname.startsWith("/challenges/");
}

export function isKnownDocument(pathname: string): boolean {
  return PAGES.has(pathname) || isRedirectSource(pathname);
}

export function negotiateDocument(input: {
  pathname: string;
  accept: string | null;
  method: string;
  rsc: boolean;
}): NegotiationDecision {
  const method = input.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return { kind: "skip" };
  if (input.rsc) return { kind: "passthrough" };

  const pathname = normalizePathname(input.pathname);
  const chosen = preferredType(input.accept);

  if (isMarkdownPath(pathname) && chosen === "text/markdown") {
    return { kind: "markdown", pathname };
  }

  if (isMarkdownPath(pathname) && chosen === null && input.accept !== null && input.accept.trim() !== "") {
    return { kind: "not-acceptable" };
  }

  if (!isKnownDocument(pathname) && chosen === "text/markdown") {
    return { kind: "markdown-not-found" };
  }

  return { kind: "passthrough" };
}
