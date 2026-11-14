import type { ReactNode } from "react";
import Link from "next/link";

export function PlayFrame({
  title,
  toolbar,
  children,
  className = "",
}: {
  readonly title: string;
  readonly toolbar?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <main id="main-content" tabIndex={-1} className={`sonify-play-page ${className}`.trim()}>
      <div className="sonify-play-wrap">
        <Link href="/challenge" className="sonify-back">
          ← Challenges
        </Link>
        <div className="sonify-play-top">
          <h1>{title}</h1>
          {toolbar}
        </div>
        {children}
      </div>
    </main>
  );
}
