import { ASSETS } from "@/data/landingData";

export interface SplitDataCardSpec {
  id: string;
  tag: string;
  indexLabel: string;
  title: string;
  sourceLine1: string;
  sourceLine2: string;
  latestLabel: string;
  latestValue: string;
  panelImg: string;
  creditText: string;
  creditLeftClass: string;
  creditColorClass: string;
  chartType: "polar" | "linear";
  unitLabel: string;
  startYearLabel: string;
  endYearLabel?: string;
  lineSvg?: string;
  dotLeftClass: string;
  dotTopClass: string;
}

export const SPLIT_DATA_CARDS: Record<"co2" | "temperature" | "methane" | "seaIce", SplitDataCardSpec> = {
  co2: {
    id: "co2",
    tag: "Greenhouse gases",
    indexLabel: "01 / 04",
    title: "CO₂",
    sourceLine1: "NOAA GML · Mauna Loa",
    sourceLine2: "Mar 1958 – Sep 2026 · monthly",
    latestLabel: "Latest · Sep 2026",
    latestValue: "426.07 ppm",
    panelImg: ASSETS.chartPanelCo2Bg,
    creditText: "NASA SVS 5115 · CO₂ in 2021",
    creditLeftClass: "left-[426px]",
    creditColorClass: "text-[rgba(242,242,240,0.6)]",
    chartType: "polar",
    unitLabel: "PPM",
    startYearLabel: "1958 ↻ 2026",
    dotLeftClass: "left-[162.39px]",
    dotTopClass: "top-[17.43px]",
  },
  temperature: {
    id: "temperature",
    tag: "Global climate",
    indexLabel: "02 / 04",
    title: "Temperature",
    sourceLine1: "NASA GISTEMP v4 · global",
    sourceLine2: "Jan 1880 – Sep 2026 · monthly",
    latestLabel: "Latest · Sep 2026",
    latestValue: "+1.38 °C vs 1951–80",
    panelImg: ASSETS.chartPanelTemperatureMap,
    creditText: "Map · NASA SVS 5603 · 2025 vs 1951–80",
    creditLeftClass: "left-[356px]",
    creditColorClass: "text-[rgba(242,242,240,0.7)]",
    chartType: "linear",
    unitLabel: "°C",
    startYearLabel: "1880",
    endYearLabel: "2026",
    lineSvg: ASSETS.chartLineTemperature,
    dotLeftClass: "left-[309.14px]",
    dotTopClass: "top-[50.6px]",
  },
  methane: {
    id: "methane",
    tag: "Greenhouse gases",
    indexLabel: "04 / 04",
    title: "Methane",
    sourceLine1: "NOAA GML · global mean",
    sourceLine2: "Jul 1983 – Jun 2026 · monthly",
    latestLabel: "Latest · Jun 2026",
    latestValue: "1934.57 ppb",
    panelImg: ASSETS.chartPanelMethaneGlobe,
    creditText: "NASA SVS 5116 · methane in 2021",
    creditLeftClass: "left-[398px]",
    creditColorClass: "text-[rgba(242,242,240,0.7)]",
    chartType: "linear",
    unitLabel: "PPB",
    startYearLabel: "1983",
    endYearLabel: "2026",
    lineSvg: ASSETS.chartLineMethane,
    dotLeftClass: "left-[309.14px]",
    dotTopClass: "top-[49.28px]",
  },
  seaIce: {
    id: "seaIce",
    tag: "Polar ice",
    indexLabel: "03 / 04",
    title: "Arctic sea ice",
    sourceLine1: "NSIDC Sea Ice Index · Sept. extent",
    sourceLine2: "Sep 1979 – Sep 2026 · yearly",
    latestLabel: "Latest · Sep 2026",
    latestValue: "4.81 million km²",
    panelImg: ASSETS.chartPanelSeaIceMap,
    creditText: "NASA SVS 5677 · yellow = 1981–2010 avg min",
    creditLeftClass: "left-[320px]",
    creditColorClass: "text-[rgba(242,242,240,0.7)]",
    chartType: "linear",
    unitLabel: "MILLION KM²",
    startYearLabel: "1979",
    endYearLabel: "2026",
    lineSvg: ASSETS.chartLineSeaIce,
    dotLeftClass: "left-[309.14px]",
    dotTopClass: "top-[141.84px]",
  },
};

export interface SplitPhotoCardSpec {
  id: string;
  image: string;
  eyebrow: string;
  title: string;
  credit: string;
}

export const SPLIT_PHOTO_CARDS: Record<"blackMarble" | "artemis", SplitPhotoCardSpec> = {
  blackMarble: {
    id: "blackMarble",
    image: ASSETS.photoBlackMarble,
    eyebrow: "Satellite composite · city lights",
    title: "Earth at night",
    credit: "NASA Earth Observatory · Black Marble 2016",
  },
  artemis: {
    id: "artemis",
    image: ASSETS.photoArtemisEarthset,
    eyebrow: "Real photo · Artemis II · Orion",
    title: "Earthset from Orion",
    credit: "NASA · Artemis II crew · 6 Apr 2026",
  },
};

function DataCardChartOverlay({ spec }: Readonly<{ spec: SplitDataCardSpec }>) {
  return (
    <div className="absolute h-[235.768px] left-[300px] top-[62px] w-[332px]">
      {spec.chartType === "polar" ? (
        <>
          <div className="absolute left-[105.86px] size-[120.29px] top-[60.14px]">
            <img loading="lazy" decoding="async" alt="" className="absolute block inset-0 max-w-none size-full" src={ASSETS.chartGlobeCo2} />
          </div>
          <div className="absolute h-[182.925px] left-[75.48px] top-[19.46px] w-[165.964px]">
            <div className="absolute inset-[-0.39%_-0.43%]">
              <img loading="lazy" decoding="async" alt="" className="block max-w-none size-full" src={ASSETS.chartPolarKeeling} />
            </div>
          </div>
        </>
      ) : (
        <div className="absolute h-[139.536px] left-[19.25px] top-[48.12px] w-[293.507px]">
          <div className="absolute inset-[-0.52%_-0.25%]">
            <img loading="lazy" decoding="async" alt="" className="block max-w-none size-full" src={spec.lineSvg} />
          </div>
        </div>
      )}

      <div className={`absolute ${spec.dotLeftClass} size-[7.217px] ${spec.dotTopClass}`}>
        <img loading="lazy" decoding="async" alt="" className="absolute block inset-0 max-w-none size-full" src={ASSETS.chartDataDot} />
      </div>

      <p className="absolute font-mono font-normal leading-[1.3] left-[19.25px] text-[13.232px] text-[#f2f2f0] top-[16.84px] tracking-[0.5293px] uppercase whitespace-nowrap">
        {spec.unitLabel}
      </p>
      <p className="absolute font-mono font-normal leading-[1.3] left-[19.25px] text-[13.232px] text-[#f2f2f0] top-[202.09px] tracking-[0.5293px] uppercase whitespace-nowrap">
        {spec.startYearLabel}
      </p>
      {spec.endYearLabel && (
        <p className="absolute font-mono font-normal leading-[1.3] left-[279.07px] text-[13.232px] text-[#f2f2f0] top-[202.09px] tracking-[0.5293px] uppercase whitespace-nowrap">
          {spec.endYearLabel}
        </p>
      )}
    </div>
  );
}

function DataCardTextInfo({ spec }: Readonly<{ spec: SplitDataCardSpec }>) {
  return (
    <>
      <div className="absolute content-stretch flex flex-col gap-[8px] items-start leading-[normal] left-[28px] overflow-clip top-[28px] whitespace-nowrap">
        <div className="content-stretch flex font-mono font-normal gap-[12px] items-start overflow-clip relative shrink-0 text-[11px] tracking-[0.44px] uppercase">
          <p className="relative shrink-0 text-[#f2f2f0]">{spec.tag}</p>
          <p className="relative shrink-0 text-[rgba(242,242,240,0.6)]">{spec.indexLabel}</p>
        </div>
        <p className="font-sans font-medium relative shrink-0 text-[#f2f2f0] text-[40px] tracking-[-0.4px]">
          {spec.title}
        </p>
        <p className="font-mono font-normal relative shrink-0 text-[11px] text-[rgba(242,242,240,0.8)] tracking-[0.44px] uppercase">
          {spec.sourceLine1}
        </p>
        <p className="font-mono font-normal relative shrink-0 text-[11px] text-[rgba(242,242,240,0.8)] tracking-[0.44px] uppercase">
          {spec.sourceLine2}
        </p>
      </div>

      <div className="absolute content-stretch flex flex-col font-normal gap-[6px] items-start leading-[normal] left-[28px] overflow-clip top-[286px] whitespace-nowrap">
        <p className="font-mono relative shrink-0 text-[11px] text-[rgba(242,242,240,0.7)] tracking-[0.44px] uppercase">
          {spec.latestLabel}
        </p>
        <p className="font-sans relative shrink-0 text-[#f2f2f0] text-[20px]">{spec.latestValue}</p>
      </div>

      <p
        className={`absolute font-mono font-normal leading-[normal] ${spec.creditLeftClass} text-[11px] ${spec.creditColorClass} top-[324px] tracking-[0.44px] uppercase whitespace-nowrap`}
      >
        {spec.creditText}
      </p>
    </>
  );
}

export function SplitCtaDataCard({ spec }: Readonly<{ spec: SplitDataCardSpec }>) {
  return (
    <div className="h-[360px] relative w-[644px]" data-name={`Split CTA/Card · ${spec.title}`}>
      <div className="absolute h-[360px] left-0 top-0 w-[644px]">
        <img loading="lazy" decoding="async" alt="" className="absolute block inset-0 max-w-none size-full" src={ASSETS.splitCardBgChamfer12} />
      </div>
      <div className="absolute h-[336px] left-[300px] top-[12px] w-[332px]">
        <img loading="lazy" decoding="async" alt="" className="absolute block inset-0 max-w-none size-full" src={spec.panelImg} />
      </div>
      <DataCardChartOverlay spec={spec} />
      <DataCardTextInfo spec={spec} />
    </div>
  );
}

export function SplitCtaPhotoCard({ spec }: Readonly<{ spec: SplitPhotoCardSpec }>) {
  return (
    <div className="h-[360px] relative w-[644px]" data-name={`Split CTA/Card · ${spec.title}`}>
      <div className="absolute h-[360px] left-0 top-0 w-[644px]">
        <img loading="lazy" decoding="async" alt="" className="absolute block inset-0 max-w-none size-full" src={spec.image} />
      </div>
      <div className="absolute h-[360px] left-0 top-0 w-[644px]">
        <img loading="lazy" decoding="async" alt="" className="absolute block inset-0 max-w-none size-full" src={ASSETS.splitCardPhotoGradient} />
      </div>
      <div className="absolute h-[360px] left-0 top-0 w-[644px]">
        <img loading="lazy" decoding="async" alt="" className="absolute block inset-0 max-w-none size-full" src={ASSETS.splitCardStrokeChamfer12} />
      </div>
      <div className="absolute content-stretch flex flex-col gap-[8px] items-start leading-[normal] left-[28px] overflow-clip top-[257px] whitespace-nowrap">
        <p className="font-mono font-normal relative shrink-0 text-[#f2f2f0] text-[11px] tracking-[0.44px] uppercase">
          {spec.eyebrow}
        </p>
        <p className="font-sans font-medium relative shrink-0 text-[#f2f2f0] text-[24px] tracking-[-0.24px]">
          {spec.title}
        </p>
        <p className="font-mono font-normal relative shrink-0 text-[11px] text-[rgba(242,242,240,0.8)] tracking-[0.44px] uppercase">
          {spec.credit}
        </p>
      </div>
    </div>
  );
}
