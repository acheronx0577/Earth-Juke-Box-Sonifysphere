import Link from "next/link";
import { DocumentTitle } from "@/components/shared/DocumentTitle";
import { chamferClip } from "@/components/listen/chamfer";

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-screen w-full max-w-[calc(100vw-32px)] flex-col items-center justify-center overflow-x-clip bg-[#141414] px-4 py-28 text-center text-[#f2f2f0]"
    >
      <DocumentTitle title="Signal lost — SonifySphere" />
      <p className="m-0 max-w-[calc(100vw-32px)] font-mono text-[12px] uppercase tracking-[0.14em] text-[#aaaaaa]">404</p>
      <h1 className="m-0 mt-4 max-w-[min(12ch,calc(100vw-32px))] text-balance font-sans font-bold text-[clamp(2.5rem,12vw,6rem)] uppercase leading-[0.88] tracking-[-0.03em]">
        Signal lost
      </h1>
      <p className="m-0 mt-4 max-w-[min(42ch,calc(100vw-32px))] text-[16px] leading-[1.5] text-[#aaaaaa]">
        This page is not on the map. The record still plays from home.
      </p>
      <div className="mt-8 h-px w-24 max-w-full bg-[#777777]" />
      <Link href="/" className="sonify-cut-shell mt-8 no-underline" style={{ clipPath: chamferClip(8) }}>
        <span className="sonify-cut-face font-mono text-[12px] uppercase tracking-[0.12em]" style={{ clipPath: chamferClip(8) }}>
          Return home
        </span>
      </Link>
    </main>
  );
}
