/** A day in the browser, then a week of stale-while-revalidate. URLs are not hashed, so this is not immutable. */
export const PUBLIC_ASSET_CACHE = "public, max-age=86400, stale-while-revalidate=604800";

export const PUBLIC_ASSET_SOURCES = [
  "/fonts/:path*",
  "/assets/:path*",
  "/team/:path*",
  "/about/:path*",
  "/audio/:path*",
] as const;

export function publicAssetHeaders() {
  return PUBLIC_ASSET_SOURCES.map((source) => ({
    source,
    headers: [{ key: "Cache-Control", value: PUBLIC_ASSET_CACHE }],
  }));
}
