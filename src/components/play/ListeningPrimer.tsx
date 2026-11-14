export function ListeningPrimer() {
  return (
    <section className="sonify-primer" aria-labelledby="listen-for">
      <p className="about-kicker" id="listen-for">
        What you are listening for
      </p>
      <div className="sonify-fact">
        <svg viewBox="0 0 220 48" aria-hidden="true">
          <g fill="currentColor">
            <rect x="10" y="32" width="36" height="6" />
            <rect x="62" y="25" width="36" height="6" />
            <rect x="114" y="18" width="36" height="6" />
            <rect x="166" y="10" width="36" height="6" />
          </g>
        </svg>
        <h3>The four notes climb.</h3>
        <p>They step through 1968, 1988, 2006 and 2024. Later years sound higher.</p>
      </div>
      <div className="sonify-fact">
        <svg viewBox="0 0 220 48" aria-hidden="true">
          <g fill="currentColor">
            <rect x="4" y="30" width="10" height="18" />
            <rect x="22" y="20" width="10" height="28" />
            <rect x="40" y="26" width="10" height="22" />
            <rect x="58" y="8" width="10" height="40" />
            <rect x="76" y="34" width="10" height="14" />
            <rect x="94" y="22" width="10" height="26" />
          </g>
        </svg>
        <h3>Every place has its own note.</h3>
        <p>Niño 3.4 sits highest. Antarctica and the Southern Ocean sit lowest.</p>
      </div>
      <div className="sonify-fact">
        <svg viewBox="0 0 220 48" aria-hidden="true">
          <path d="M4 24 C 14 6, 24 6, 34 24 S 54 42, 64 24 S 84 6, 94 24" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M118 24 L 133 6 L 148 42 L 163 6 L 178 42 L 193 6 L 208 24" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <h3>Records change the tone.</h3>
        <p>CO₂ and temperature are smooth. Sea ice and methane sound hollow and lower.</p>
      </div>
    </section>
  );
}
