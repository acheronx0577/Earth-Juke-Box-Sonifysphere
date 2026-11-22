/** 1 year in the browser (satisfying Lighthouse long-term asset cache), plus stale-while-revalidate. */
export const PUBLIC_ASSET_CACHE = "public, max-age=31536000, stale-while-revalidate=86400";

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
