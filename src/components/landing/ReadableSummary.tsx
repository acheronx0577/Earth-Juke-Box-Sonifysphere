import { READABLE_SUMMARY } from "@/lib/agentCopy";

/** Server-rendered text for agents and assistive tech. Clipped, not display:none. */
export function ReadableSummary() {
  return (
    <section className="sr-only" aria-label="About SonifySphere" data-agent-summary="true">
      {READABLE_SUMMARY.map((paragraph) => (
        <p key={paragraph.slice(0, 48)}>{paragraph}</p>
      ))}
    </section>
  );
}
