export const NEGOTIATED_PATHS = new Set(["/", "/about", "/listen", "/challenge", "/contact"]);

export function pathnameOf(url: string | undefined): string {
  if (!url) return "";
  const path = (url.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function isNegotiatedPath(url: string | undefined): boolean {
  return NEGOTIATED_PATHS.has(pathnameOf(url));
}
