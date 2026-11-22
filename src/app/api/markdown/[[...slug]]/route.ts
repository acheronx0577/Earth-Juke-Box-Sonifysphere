import { MARKDOWN_CONTENT_TYPE, markdownForPath, notFoundMarkdown } from "@/lib/agentCopy";

function markdownHeaders(status: number): HeadersInit {
  return {
    "Content-Type": MARKDOWN_CONTENT_TYPE,
    Vary: "Accept",
    "Cache-Control": status === 200
      ? "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
      : "public, max-age=0, must-revalidate",
  };
}

export function GET(_request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  return respond(context.params);
}

async function respond(params: Promise<{ slug?: string[] }>) {
  const { slug = [] } = await params;
  const pathname = slug.length === 0 ? "/" : `/${slug.join("/")}`;
  const body = markdownForPath(pathname) ?? notFoundMarkdown();
  const status = markdownForPath(pathname) ? 200 : 404;
  return new Response(body, { status, headers: markdownHeaders(status) });
}
