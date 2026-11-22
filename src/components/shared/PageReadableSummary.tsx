import { PAGE_SUMMARIES, type SummaryPageKey } from "@/lib/pageSummaries";

/** Server-rendered semantic overview for screen readers, crawlers, and AI agents. */
export function PageReadableSummary({ pageKey }: { pageKey: SummaryPageKey }) {
  const summary = PAGE_SUMMARIES[pageKey];
  if (!summary) return null;

  return (
    <section className="sr-only" aria-label={summary.title} data-agent-summary="true">
      {summary.h1 ? <h1>{summary.h1}</h1> : null}
      {summary.sections.map((sec) => (
        <div key={sec.heading}>
          <h2>{sec.heading}</h2>
          {sec.paragraphs.map((p) => (
            <p key={p.slice(0, 48)}>{p}</p>
          ))}
        </div>
      ))}
    </section>
  );
}
