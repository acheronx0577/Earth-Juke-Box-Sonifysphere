import { PLAIN_CONTENT_TYPE, robotsTxt } from "@/lib/agentCopy";

export function GET() {
  return new Response(robotsTxt(), {
    headers: {
      "Content-Type": PLAIN_CONTENT_TYPE,
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
