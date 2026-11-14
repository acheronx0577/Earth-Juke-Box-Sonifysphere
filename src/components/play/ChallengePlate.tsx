import type { ReactNode } from "react";
import Link from "next/link";
import { chamferClip } from "@/components/listen/chamfer";

const CLIP = chamferClip(8);

export function ChallengePlate({
  kicker,
  time,
  title,
  what,
  steps,
  reward,
  glyph,
  cta,
  href,
  solid = false,
}: {
  readonly kicker: string;
  readonly time: string;
  readonly title: string;
  readonly what: string;
  readonly steps: readonly ReactNode[];
  readonly reward: string;
  readonly glyph: ReactNode;
  readonly cta: string;
  readonly href: string;
  readonly solid?: boolean;
}) {
  return (
    <article
      className="sonify-plate"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) return;
        const link = event.currentTarget.querySelector("a");
        link?.click();
      }}
    >
      <div className="sonify-plate-in">
        <div className="sonify-plate-top">
          <span className="about-kicker">{kicker}</span>
          <span className="sonify-time">{time}</span>
        </div>
        <h2>{title}</h2>
        <p className="sonify-what">{what}</p>
        <div>
          <span className="about-kicker sonify-lbl">How to play</span>
          <ol className="sonify-steps">
            {steps.map((step, index) => (
              <li key={index}>
                <span className="sonify-sq">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="sonify-reward">
          {glyph}
          <span>
            <span className="about-kicker sonify-lbl">You get</span>
            {reward}
          </span>
        </div>
        <div className="sonify-plate-cta">
          <Link href={href} className={`sonify-cut-shell ${solid ? "is-solid" : ""}`} style={{ clipPath: CLIP }}>
            <span className="sonify-cut-face" style={{ clipPath: CLIP }}>
              {cta}
              <span aria-hidden="true">→</span>
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}
