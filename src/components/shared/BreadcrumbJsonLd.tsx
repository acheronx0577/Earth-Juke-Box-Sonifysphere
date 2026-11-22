import { breadcrumbJsonLd } from "@/lib/agentCopy";

export function BreadcrumbJsonLd({ name, path }: { name: string; path: string }) {
  const json = JSON.stringify(breadcrumbJsonLd(name, path)).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
