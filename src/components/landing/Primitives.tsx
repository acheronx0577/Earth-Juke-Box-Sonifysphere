import type { ReactNode } from "react";
import Link from "next/link";
import { chamferClip } from "@/components/listen/chamfer";
import { ASSETS } from "@/data/landingData";

interface PrimaryPillButtonProps {
  readonly label: string;
  readonly href: string;
  readonly className?: string;
}

const PRIMARY_PILL_CLASS =
  "sonify-btn-primary no-underline content-stretch flex items-center justify-center px-[32px] py-[16px] relative shrink-0";

function PrimaryPillFace({ label }: Readonly<{ label: ReactNode }>) {
  return (
    <>
      <img
        alt=""
        className="absolute block inset-0 max-w-none size-full pointer-events-none"
        src={ASSETS.primaryPillBg}
      />
      <span className="relative inline-flex shrink-0 items-center gap-2 font-sans text-[18px] font-normal leading-[1.45] whitespace-nowrap text-[#141414]">
        {label}
      </span>
    </>
  );
}

export function PrimaryPillButton({ label, href, className }: Readonly<PrimaryPillButtonProps>) {
  return (
    <Link href={href} className={className ?? PRIMARY_PILL_CLASS}>
      <PrimaryPillFace label={label} />
    </Link>
  );
}

const HEAR_CLIP = chamferClip(8);

export function PrimaryPillAction({
  label,
  onClick,
  pressed = false,
  busy = false,
}: Readonly<{ label: ReactNode; onClick: () => void; pressed?: boolean; busy?: boolean }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-busy={busy || undefined}
      className="sonify-cut-shell is-solid sonify-hear"
      style={{ clipPath: HEAR_CLIP }}
    >
      <span className="sonify-cut-face" style={{ clipPath: HEAR_CLIP }}>
        {label}
      </span>
    </button>
  );
}

interface TextLinkButtonProps {
  readonly label: string;
  readonly href: string;
  readonly className?: string;
}

export function TextLinkButton({ label, href, className }: Readonly<TextLinkButtonProps>) {
  return (
    <Link
      href={href}
      className={className ?? "sonify-text-link no-underline content-stretch flex items-start py-[4px] relative shrink-0"}
    >
      <span className="font-sans font-normal leading-[1.45] relative shrink-0 text-[#f2f2f0] text-[15px] whitespace-nowrap">
        {label}
      </span>
    </Link>
  );
}

export function FaviconMark64({ className }: Readonly<{ className?: string }>) {
  return (
    <div className={className ?? "relative shrink-0 size-[64px]"} data-name="CTA/Mark · Favicon A + cream edge (64)">
      <img
        alt="SonifySphere mark"
        className="absolute block inset-0 max-w-none size-full"
        width={64}
        height={64}
        src={ASSETS.ctaMarkFaviconA64}
      />
    </div>
  );
}
