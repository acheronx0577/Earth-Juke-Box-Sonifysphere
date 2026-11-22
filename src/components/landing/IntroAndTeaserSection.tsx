import {
  ASSETS,
  CHAPTER_TEASERS,
  CHAPTERS_DISPLAY_HEADER,
  INTRO_COPY,
  STAT_ITEMS,
} from "@/data/landingData";
import { TextLinkButton } from "@/components/landing/Primitives";

export function IntroSection() {
  return (
    <section
      id="about"
      className="content-stretch flex flex-col gap-[32px] sm:gap-[48px] items-start pb-[64px] sm:pb-[96px] pt-6 sm:pt-10 px-4 sm:px-6 lg:px-10 xl:px-14 relative shrink-0 w-full max-w-[1440px] xl:max-w-[1600px] 2xl:max-w-[1800px] min-h-[400px] sm:min-h-[500px] h-auto mx-auto"
      data-name="Landing/Intro"
    >
      <div
        className="relative shrink-0 w-[min(635.7px,calc(100vw-2rem))] aspect-[635.7/97.96]"
        data-name="Landing/Intro/Header (Planet Kosmos outlines)"
      >
        <img
          alt="listen to the air"
          className="absolute block inset-0 max-w-none size-full"
          src={ASSETS.introHeaderListenToTheAir}
        />
      </div>

      <div className="content-stretch flex items-start justify-end relative shrink-0 w-full">
        <p className="sonify-intro-copy font-sans font-medium leading-[1.1] relative shrink-0 text-[#f2f2f0] text-[28px] sm:text-[36px] md:text-[40px] lg:text-[48px] tracking-[-0.72px] w-full max-w-[920px] xl:max-w-[1040px]">
          <span className="sonify-intro-lead text-[#f2f2f0]">{INTRO_COPY.lead}</span>
          <span className="sonify-intro-body text-[rgba(242,242,240,0.22)]" data-intro-body={INTRO_COPY.body}>
            {INTRO_COPY.body}
          </span>
        </p>
      </div>
    </section>
  );
}

function ChaptersHeaderSection() {
  return (
    <section
      className="sonify-chapters-header sticky top-0 h-[100svh] w-full flex flex-col justify-center items-center text-center overflow-hidden z-[1] pointer-events-none select-none px-4"
      data-name="Landing/Chapters/Header"
      aria-label={`${CHAPTERS_DISPLAY_HEADER.line1} ${CHAPTERS_DISPLAY_HEADER.line2}`}
    >
      <h2 className="sonify-chapters-display-title flex flex-col items-center justify-center gap-[1.5vh] sm:gap-[2.5vh] w-full max-w-[1440px] select-none">
        <span className="sr-only">Story chapters</span>
        <span className="sonify-chapter-line-mask block overflow-hidden w-[min(565px,calc((100vw-3rem)*0.615))] aspect-[250/80]">
          <span className="sonify-chapter-line-inner block size-full">
            <img
              alt=""
              className="block size-full object-contain pointer-events-none"
              src={ASSETS.displayStory}
            />
          </span>
        </span>
        <span className="sonify-chapter-line-mask block overflow-hidden w-[min(920px,calc(100vw-3rem))] aspect-[1912/376]">
          <span className="sonify-chapter-line-inner block size-full">
            <img
              alt=""
              className="block size-full object-contain pointer-events-none"
              src={ASSETS.displayChapters}
            />
          </span>
        </span>
      </h2>
    </section>
  );
}

function ChapterTeaserSection() {
  return (
    <section
      className="sonify-chapters-section content-stretch flex flex-col items-center py-[7.5rem] px-4 sm:px-6 relative z-10 shrink-0 w-full overflow-hidden"
      data-name="Landing/Chapter teaser (01 · 02 · 03)"
    >
      <p className="font-mono font-medium leading-[1.2] relative shrink-0 text-[#f2f2f0] text-[13px] tracking-[0.52px] uppercase whitespace-nowrap mb-12">
        {CHAPTERS_DISPLAY_HEADER.label}
      </p>

      <div
        className="sonify-chapters-list content-stretch flex flex-col gap-[7.5rem] items-center relative shrink-0 w-full max-w-[92vw] sm:max-w-[80vw] md:max-w-[65vw] lg:w-[40%] lg:max-w-none mx-auto"
        data-name="Landing/Chapters/List"
      >
        {CHAPTER_TEASERS.map((teaser) => (
          <div
            key={teaser.id}
            className="sonify-teaser-card featured-missions-item content-stretch flex flex-col gap-[1.5rem] justify-center items-center text-center p-[3rem_1.5rem] bg-[#929292] rounded-[0.5rem] relative shrink-0 w-full shadow-2xl will-change-transform"
            data-name={`Chapter teaser · ${teaser.chapterNumber}`}
          >
            <p className="font-mono font-semibold uppercase text-[clamp(0.8rem,0.75vw,0.85rem)] leading-none text-[#141414]">
              {teaser.counter}
            </p>
            <h3 className="font-schabo uppercase leading-[0.85] text-[clamp(2.5rem,6.5vw,5rem)] tracking-[clamp(0rem,-0.5vw,-0.075rem)] text-[#141414] text-center w-full px-2">
              {teaser.title}
            </h3>
            <div className="featured-mission-item-img w-full aspect-[5/3] overflow-hidden rounded-[0.5rem] relative shrink-0">
              <img
                alt={teaser.imageAlt}
                className="block size-full object-cover"
                src={teaser.image}
                width={800}
                height={480}
                loading="lazy"
                decoding="async"
              />
            </div>
            <p className="font-mono font-semibold uppercase text-[clamp(0.8rem,0.75vw,0.85rem)] leading-none text-[#141414]">
              {teaser.tag}
            </p>
            <p className="font-mono font-medium text-[clamp(0.85rem,0.75vw,0.95rem)] leading-normal text-[#141414]/85 uppercase tracking-[0.4px]">
              {teaser.fact}
            </p>
            <a
              href={teaser.listenHref}
              className="sonify-btn-primary inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-[#141414] hover:bg-[#262626] text-[#e6e6e4] border border-[#262626] rounded-[4px] font-mono text-[12px] font-semibold uppercase tracking-[1.8px] transition-all duration-200 active:scale-95 shadow-md mt-2"
            >
              <span>Listen to this bit</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        ))}
      </div>

      <div className="mt-16">
        <TextLinkButton label="See all chapters →" href="/listen?view=story" />
      </div>
    </section>
  );
}

export function ChaptersBlock() {
  return (
    <div className="sonify-chapters-block relative w-full block" id="story">
      <ChaptersHeaderSection />
      <div className="sonify-chapters-cards-layer relative z-[2] w-full">
        <ChapterTeaserSection />
      </div>
    </div>
  );
}

export function StatsSection() {
  return (
    <section
      className="sonify-stats-section content-stretch flex flex-col items-start pb-[80px] sm:pb-[120px] px-4 sm:px-6 lg:px-10 xl:px-14 relative shrink-0 w-full max-w-[1440px] xl:max-w-[1600px] 2xl:max-w-[1800px] mx-auto overflow-hidden"
      data-name="Landing/Stats"
    >
      <div className="sonify-stats-panel content-stretch flex flex-wrap md:flex-nowrap gap-[16px] sm:gap-[24px] items-start relative shrink-0 w-full">
        {STAT_ITEMS.map((stat) => (
          <div
            key={stat.id}
            className="sonify-stat-cell content-stretch flex flex-col gap-[32px] sm:gap-[48px] items-start min-w-[140px] flex-1 p-4 sm:p-[24px] relative"
            data-name={`Stat · ${stat.label}`}
          >
            <img alt="" className="sonify-stat-background absolute block inset-0 max-w-none size-full pointer-events-none" src={stat.bgSvg} />
            <div className="sonify-stat-label content-stretch flex gap-[10px] items-center relative shrink-0">
              <div className="bg-[rgba(242,242,240,0.62)] relative shrink-0 size-[8px]" />
              <p className="font-mono font-normal leading-[1.3] relative shrink-0 text-[#f2f2f0] text-[11px] tracking-[0.44px] uppercase whitespace-nowrap">
                {stat.label}
              </p>
            </div>
            <div className="sonify-stat-reading content-stretch flex flex-col gap-[6px] items-start relative shrink-0 text-[#f2f2f0] whitespace-nowrap">
              <p
                className="sonify-stat-number font-sans font-medium leading-none relative shrink-0 text-[48px] sm:text-[72px] tracking-[-1.44px]"
                data-stat-value={stat.numericValue}
                data-stat-decimals={stat.decimals}
                data-stat-final={stat.valueText}
              >
                {stat.valueText}
              </p>
              <p className="font-mono font-normal leading-[1.3] relative shrink-0 text-[11px] tracking-[0.44px] uppercase">
                {stat.unit}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
