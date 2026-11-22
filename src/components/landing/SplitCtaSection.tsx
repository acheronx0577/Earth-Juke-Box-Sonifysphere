import Link from "next/link";
import { ASSETS, SPLIT_ROWS_MOTION } from "@/data/landingData";
import { FaviconMark64, PrimaryPillButton } from "@/components/landing/Primitives";
import {
  SPLIT_DATA_CARDS,
  SPLIT_PHOTO_CARDS,
  SplitCtaDataCard,
  SplitCtaPhotoCard,
} from "@/components/landing/SplitCtaCards";

const ROW_PAIRS = [
  {
    rowIndex: 0,
    left: <SplitCtaDataCard spec={SPLIT_DATA_CARDS.co2} />,
    right: <SplitCtaDataCard spec={SPLIT_DATA_CARDS.temperature} />,
  },
  {
    rowIndex: 1,
    left: <SplitCtaDataCard spec={SPLIT_DATA_CARDS.methane} />,
    right: <SplitCtaDataCard spec={SPLIT_DATA_CARDS.seaIce} />,
  },
  {
    rowIndex: 2,
    left: <SplitCtaPhotoCard spec={SPLIT_PHOTO_CARDS.blackMarble} />,
    right: <SplitCtaPhotoCard spec={SPLIT_PHOTO_CARDS.artemis} />,
  },
] as const;

function SplitCtaCentreBlock() {
  return (
    <div
      className="sonify-cta-centre absolute content-stretch flex flex-col items-center left-1/2 -translate-x-1/2 overflow-clip top-[325px] w-[min(440px,calc(100vw-2rem))] max-w-full opacity-0 invisible pointer-events-none"
      data-name="CTA/Centre (revealed · behind cards, z under)"
    >
      <FaviconMark64 className="sonify-cta-logo relative shrink-0 size-[64px]" />
      <div className="h-[32px] relative shrink-0 w-px" />
      <h2
        className="h-[102.931px] relative shrink-0 w-[min(400px,calc(100vw-3rem))] max-w-full"
        data-name="CTA/Title · tune in"
      >
        <span className="sr-only">Tune in</span>
        <img
          alt=""
          className="absolute block inset-0 max-w-none size-full"
          src={ASSETS.ctaTitleTuneIn}
        />
      </h2>
      <div className="h-[24px] relative shrink-0 w-px" />
      <p className="sonify-cta-copy font-sans font-normal leading-[normal] relative shrink-0 text-[18px] text-[rgba(242,242,240,0.75)] text-center w-full max-w-[440px]">
        Four Earth records you can play. The figures shown are examples, not a live feed.
      </p>
      <div className="h-[48px] relative shrink-0 w-px" />
      <div
        className="sonify-cta-actions content-stretch flex flex-col gap-[12px] items-center overflow-clip relative shrink-0"
        data-name="CTA/Actions (Start listening + text link under)"
      >
        <PrimaryPillButton label="Start listening" href="/listen?sound=on" />
        <Link
          href="/listen?data=co2"
          className="sonify-text-link no-underline content-stretch flex items-start py-[4px] relative shrink-0"
          data-name="CTA/Pick a dataset →"
        >
          <span className="font-mono font-normal leading-[1.45] relative shrink-0 text-[12px] text-[rgba(242,242,240,0.6)] hover:text-[#f2f2f0] transition-colors duration-200 whitespace-nowrap">
            Pick a dataset →
          </span>
        </Link>
      </div>
    </div>
  );
}

export function SplitCtaSection() {
  return (
    <section
      className="sonify-split-cta h-[1240px] relative shrink-0 w-full overflow-visible"
      data-name="Landing/CTA · Split scroll reveal"
    >
      <SplitCtaCentreBlock />

      <div
        className="sonify-cta-cards absolute h-[1240px] left-1/2 -translate-x-1/2 top-0 w-[1440px] overflow-visible pointer-events-none"
        data-name="CTA/Cards (3 rows × 2 · progress 0%)"
      >
        {ROW_PAIRS.map(({ rowIndex, left, right }) => {
          const motion = SPLIT_ROWS_MOTION[rowIndex];

          return (
            <div key={rowIndex} className="sonify-cta-row" data-row-index={rowIndex}>
              <div
                className="sonify-cta-card sonify-cta-card-left absolute h-[360px] left-[64px] w-[644px] origin-center will-change-transform"
                style={{ top: `${motion.rowTop}px` }}
              >
                {left}
              </div>
              <div
                className="sonify-cta-card sonify-cta-card-right absolute h-[360px] left-[732px] w-[644px] origin-center will-change-transform"
                style={{ top: `${motion.rowTop}px` }}
              >
                {right}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
