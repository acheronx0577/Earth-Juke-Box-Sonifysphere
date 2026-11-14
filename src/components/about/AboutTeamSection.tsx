import { TEAM } from "@/data/aboutData";
import { nameInitials, nameSignature } from "@/lib/nameSignature";

function NameMark({ name, height }: { readonly name: string; readonly height: number }) {
  const bars = nameSignature(name, height);
  const width = Math.max(bars.length * 6, 3);
  return (
    <svg className="about-sig" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={height - bar.h} width={3} height={bar.h} fill="currentColor" />
      ))}
    </svg>
  );
}

export function AboutTeamSection() {
  return (
    <section className="about-sec about-team" aria-labelledby="team-h">
      <div className="about-wrap">
        <div className="about-sec-head">
          <p className="about-kicker">The team</p>
          <h2 id="team-h" data-about-h2>
            Six people made this.
          </h2>
        </div>
        <ol className="about-reg" data-testid="about-team">
          {TEAM.map((member, index) => {
            const initials = nameInitials(member.name);
            const band = `${member.name}${member.role ? ` · ${member.role}` : ""}`;
            return (
              <li key={member.name} className="about-row" data-roll="" data-team-row="">
                <p className="about-idx">{String(index + 1).padStart(2, "0")} / 06</p>
                <div className="sonify-roll" aria-hidden="true">
                  <div className="sonify-roll__stack">
                    <div>{member.name}</div>
                    <div className="sonify-roll__band">
                      <b>{initials}</b>
                      <NameMark name={member.name} height={40} />
                      <span>{band}</span>
                    </div>
                    <div>{member.name}</div>
                  </div>
                </div>
                <span className="sr-only">
                  {member.name}
                  {member.role ? `, ${member.role}` : ""}
                </span>
                <span className="about-meta">
                  <NameMark name={member.name} height={34} />
                  {member.role ? <span className="about-role">{member.role}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="about-kicker about-footnote">Each mark is drawn from the letters of the name.</p>
      </div>
    </section>
  );
}
