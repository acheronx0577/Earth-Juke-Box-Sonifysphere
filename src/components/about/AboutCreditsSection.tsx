import { ABOUT_CREDIT_ROWS } from "@/data/aboutData";

export function AboutCreditsSection() {
  return (
    <section className="about-wrap about-credits" aria-labelledby="credits-h">
      <div className="about-sec-head">
        <p className="about-kicker" id="credits-h">
          Credits
        </p>
      </div>
      <div>
        {ABOUT_CREDIT_ROWS.map((row) => (
          <div key={row.id} className="about-crow">
            <p className="about-kicker">{row.label}</p>
            <p className="about-credit-value">{row.text}</p>
            {row.linkHref && row.linkLabel ? (
              <a href={row.linkHref} target="_blank" rel="noreferrer" className="about-credit-link">
                {row.linkLabel}
              </a>
            ) : (
              <span className="hidden min-[1001px]:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
