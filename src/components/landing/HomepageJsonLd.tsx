import { homepageJsonLd, organizationJsonLd, siteNavigationJsonLd } from "@/lib/agentCopy";

export function HomepageJsonLd() {
  const json = JSON.stringify(homepageJsonLd()).replace(/</g, "\\u003c");
  const orgJson = JSON.stringify(organizationJsonLd()).replace(/</g, "\\u003c");
  const navJson = JSON.stringify(siteNavigationJsonLd()).replace(/</g, "\\u003c");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: orgJson }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: navJson }} />
    </>
  );
}
