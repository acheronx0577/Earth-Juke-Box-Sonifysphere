import Link from "next/link";
import { TechText } from "@/components/shared/TechText";

function FooterNavAndDataColumns({ showChallenge }: Readonly<{ showChallenge: boolean }>) {
  return (
    <>
      <div className="flex flex-col gap-[10px] items-start relative w-full min-w-0">
        <p className="font-mono font-medium leading-[1.2] relative text-[13px] tracking-[0.52px] uppercase">
          Navigate
        </p>
        <Link
          href="/listen"
          className="sonify-text-link no-underline text-[#f2f2f0] font-sans font-normal leading-[1.45] text-[15px] w-full"
        >
          Listen
        </Link>
        <Link
          href="/story"
          className="sonify-text-link no-underline text-[#f2f2f0] font-sans font-normal leading-[1.45] text-[15px] w-full"
        >
          Story
        </Link>
        <Link
          href="/about"
          className="sonify-text-link no-underline text-[#f2f2f0] font-sans font-normal leading-[1.45] text-[15px] w-full"
        >
          About
        </Link>
        {showChallenge ? (
          <Link
            href="/challenge"
            className="sonify-text-link no-underline text-[#f2f2f0] font-sans font-normal leading-[1.45] text-[15px] w-full"
          >
            Challenge
          </Link>
        ) : null}
      </div>

      <div className="flex flex-col gap-[10px] items-start relative w-full min-w-0">
        <p className="font-mono font-medium leading-[1.2] relative text-[13px] tracking-[0.52px] uppercase">
          CO₂ data
        </p>
        <p className="font-sans font-normal leading-[1.45] text-[15px] w-full">
          NOAA Global Monitoring Laboratory
        </p>
        <p className="font-sans font-normal leading-[1.45] text-[15px] w-full">
          Mauna Loa Observatory · monthly mean
        </p>
        <a
          className="sonify-text-link text-[#f2f2f0] block cursor-pointer decoration-from-font decoration-solid font-sans font-normal leading-[1.45] text-[15px] underline w-full"
          href="https://gml.noaa.gov/ccgg/trends/"
          target="_blank"
          rel="noreferrer"
        >
          gml.noaa.gov
        </a>
      </div>
    </>
  );
}

function FooterImageAndTypeColumns() {
  return (
    <>
      <div className="flex flex-col gap-[10px] items-start relative w-full min-w-0">
        <p className="font-mono font-medium leading-[1.2] relative text-[13px] tracking-[0.52px] uppercase">
          Earth image
        </p>
        <p className="font-sans font-normal leading-[1.45] text-[15px] w-full">
          NASA EPIC Team (DSCOVR)
        </p>
        <a
          className="sonify-text-link text-[#f2f2f0] block cursor-pointer decoration-from-font decoration-solid font-sans font-normal leading-[1.45] text-[15px] underline w-full"
          href="https://epic.gsfc.nasa.gov/"
          target="_blank"
          rel="noreferrer"
        >
          epic.gsfc.nasa.gov
        </a>
      </div>

      <div className="flex flex-col gap-[10px] items-start relative w-full min-w-0">
        <p className="font-mono font-medium leading-[1.2] relative text-[13px] tracking-[0.52px] uppercase">
          Type
        </p>
        <p className="font-sans font-normal leading-[1.45] text-[15px] w-full break-words">
          <span>{"Display: Planet Kosmos by Mads Rydahl, The Planet ("}</span>
          <a
            className="text-[#f2f2f0] cursor-pointer decoration-from-font decoration-solid underline"
            href="https://www.planet.dk/fonts/"
            target="_blank"
            rel="noreferrer"
          >
            planet.dk
          </a>
          <span>{")"}</span>
        </p>
        <p className="font-sans font-normal leading-[1.45] text-[15px] w-full">
          UI: Geist / Geist Mono (SIL OFL 1.1)
        </p>
      </div>
    </>
  );
}

export function FooterSection({ showChallenge = false }: Readonly<{ showChallenge?: boolean }>) {
  return (
    <footer
      className="flex flex-col items-center py-8 sm:py-12 lg:py-16 px-3 sm:px-6 lg:px-8 xl:px-12 relative w-full overflow-visible z-20 bg-transparent"
      data-name="Landing/Footer"
    >
      <div className="relative w-full max-w-[1800px] mx-auto overflow-visible">
        <div className="sonify-footer-bg-wrapper" aria-hidden="true">
          <div className="sonify-footer-bg" />
        </div>

        <div className="relative z-10 flex flex-col gap-12 sm:gap-16 lg:gap-20 items-center pt-20 sm:pt-24 lg:pt-28 pb-12 sm:pb-16 lg:pb-20 px-6 sm:px-10 lg:px-14 xl:px-20 overflow-visible">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 items-start relative text-[#f2f2f0] w-full max-w-[1440px] xl:max-w-[1600px] 2xl:max-w-[1800px] z-10">
            <FooterNavAndDataColumns showChallenge={showChallenge} />
            <FooterImageAndTypeColumns />
          </div>

          <div className="relative shrink-0 w-full max-w-[1346.4px] xl:max-w-[1500px] 2xl:max-w-[1680px] aspect-[1346.4/239.467] z-30 overflow-visible font-['PlanetKosmos']">
            <TechText
              text="sonifysphere"
              className="cursor-target"
              fontFamily="PlanetKosmos"
              fontWeight={400}
              fontSize={160}
              letterSpacing={-0.03}
              color="#f2f2f0"
              accentColor="#f2f2f0"
              reveal="letter"
              dashLength={4}
              dashGap={2}
              strokeWidth={1.5}
              specks={15}
              selection={true}
              labels={true}
              draggable={true}
              bounce={0.4}
              clickKick={true}
              intro="none"
              sweep={true}
              speed={0.5}
              guides={false}
              bleedTop={520}
              bleedBottom={220}
              bleedX={200}
            />
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-4 font-mono font-normal items-start sm:items-center justify-between leading-[1.4] relative text-[#f2f2f0] text-[11px] tracking-[0.44px] uppercase w-full max-w-[1440px] xl:max-w-[1600px] 2xl:max-w-[1800px] z-10">
            <p className="m-0">Space Apps 2026 · The Earth Information Jukebox</p>
            <p className="m-0 max-w-xl">
              Hero image: AI-generated illustration (ChatGPT), not a real person or a real photo of Earth · CO₂: NOAA GML Mauna Loa
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
