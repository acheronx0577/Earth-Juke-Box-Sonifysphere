import { homepageJsonLd } from "@/lib/agentCopy";

export function HomepageJsonLd() {
  const json = JSON.stringify(homepageJsonLd()).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
