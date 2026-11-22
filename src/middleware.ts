import { NextResponse, type NextRequest } from "next/server";
import { MARKDOWN_CONTENT_TYPE, notFoundMarkdown } from "@/lib/agentCopy";
import { setDocumentVary } from "@/lib/contentNegotiation";
import { negotiateDocument } from "@/lib/documentNegotiation";

function isRscRequest(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  return request.headers.has("rsc")
    || request.headers.has("next-router-prefetch")
    || request.headers.has("next-router-segment-prefetch")
    || accept.includes("text/x-component");
}

export function middleware(request: NextRequest) {
  const decision = negotiateDocument({
    pathname: request.nextUrl.pathname,
    accept: request.headers.get("accept"),
    method: request.method,
    rsc: isRscRequest(request),
  });

  if (decision.kind === "skip") return NextResponse.next();

  if (decision.kind === "markdown") {
    const url = request.nextUrl.clone();
    url.pathname = decision.pathname === "/" ? "/api/markdown" : `/api/markdown${decision.pathname}`;
    const rewritten = NextResponse.rewrite(url);
    setDocumentVary(rewritten.headers);
    return rewritten;
  }

  if (decision.kind === "not-acceptable") {
    return new NextResponse("Not Acceptable\n\nAvailable: text/html, text/markdown\n", {
      status: 406,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept",
      },
    });
  }

  if (decision.kind === "markdown-not-found") {
    return new NextResponse(request.method === "HEAD" ? null : notFoundMarkdown(), {
      status: 404,
      headers: {
        "Content-Type": MARKDOWN_CONTENT_TYPE,
        Vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  }

  const response = NextResponse.next();
  setDocumentVary(response.headers);
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/|_vercel/|.*\\..*).*)"],
};
