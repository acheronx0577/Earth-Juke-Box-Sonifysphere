"use client";

import { useRef } from "react";
import {
  ASSETS,
  THEME_CARDS,
  type ThemeCardConfig,
  type ThemeId,
} from "@/data/landingData";
import { TextLinkButton } from "@/components/landing/Primitives";
import { datasetForTheme } from "@/data/datasets";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";

function ThemeCardChrome({ isActive }: Readonly<{ isActive: boolean }>) {
  const baseBg = isActive ? ASSETS.themeCardActiveBg : ASSETS.themeCardDefaultBg;

  return (
    <>
      <img
        alt=""
        className="absolute block inset-0 max-w-none size-full pointer-events-none"
        src={baseBg}
      />
      {!isActive && (
        <img
          alt=""
          className="absolute block inset-0 max-w-none size-full pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 ease-out"
          src={ASSETS.themeCardActiveBg}
        />
      )}
      <div className="absolute inset-[-6px] pointer-events-none opacity-0 group-focus-visible:opacity-100 transition-opacity duration-200 ease-out">
        <img
          alt=""
          className="block size-full"
          src={ASSETS.themeCardFocusRing}
        />
      </div>
    </>
  );
}

function ThemeCardBody({
  card,
  isActive,
}: Readonly<{ card: ThemeCardConfig; isActive: boolean }>) {
  const opacityClass = isActive
    ? "opacity-100"
    : "opacity-80 group-hover:opacity-100 group-focus-visible:opacity-100";

  return (
    <div
      className={`absolute inset-0 content-stretch flex flex-col justify-between p-6 sm:p-7 2xl:p-8 transition-opacity duration-200 ease-out ${opacityClass}`}
    >
      {/* Card Header (Tag & Playing status) */}
      <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
        <div className="content-stretch flex gap-2 items-center px-2.5 py-1.5 relative shrink-0">
          <img
            alt=""
            className="absolute block inset-0 max-w-none size-full"
            src={card.tagBg}
          />
          <span className="font-mono font-normal leading-[1.3] relative shrink-0 text-[#f2f2f0] text-[11px] sm:text-[12px] tracking-[0.44px] uppercase whitespace-nowrap">
            {card.tag}
          </span>
        </div>
        {isActive && (
          <span className="font-mono font-semibold leading-[1.3] relative shrink-0 text-[#f2f2f0] text-[11px] sm:text-[12px] tracking-[0.44px] uppercase whitespace-nowrap">
            ■ Playing
          </span>
        )}
      </div>

      {/* Sparkline Graphic */}
      <div className="h-[135px] sm:h-[150px] lg:h-[165px] 2xl:h-[185px] relative shrink-0 w-full my-auto flex items-center justify-center p-2">
        <img
          alt=""
          className="block w-full h-full object-contain pointer-events-none"
          src={card.sparkline}
        />
      </div>

      {/* Card Details & Typography */}
      <div className="flex flex-col gap-1.5 relative shrink-0 w-full">
        <p className="font-sans font-medium leading-[1.08] relative shrink-0 text-[#f2f2f0] text-[28px] sm:text-[32px] md:text-[34px] 2xl:text-[38px] tracking-[-0.02em] w-full">
          {card.title}
        </p>
        <p className="font-mono font-normal leading-[1.3] relative shrink-0 text-[#f2f2f0]/90 text-[11px] sm:text-[12px] tracking-[0.44px] uppercase w-full">
          {card.source}
        </p>
        <p className="font-mono font-normal leading-[1.3] relative shrink-0 text-[#f2f2f0]/80 text-[11px] sm:text-[12px] tracking-[0.44px] uppercase w-full">
          {card.cadence}
        </p>
        <p className="font-mono font-normal leading-[1.3] relative shrink-0 text-[#f2f2f0]/70 text-[11px] sm:text-[12px] tracking-[0.44px] uppercase whitespace-nowrap">
          {card.latestDate}
        </p>
        <p className="font-mono font-semibold leading-[1.2] relative shrink-0 text-[#f2f2f0] text-[18px] sm:text-[20px] 2xl:text-[24px] w-full mt-1">
          {card.latestValue}
        </p>
      </div>
    </div>
  );
}

interface ThemeCardItemProps {
  readonly card: ThemeCardConfig;
  readonly isActive: boolean;
  readonly onSelect: (id: ThemeId) => void;
  readonly className?: string;
  readonly onPointerDown?: () => void;
}

function ThemeCardItem({
  card,
  isActive,
  onSelect,
  className = "",
  onPointerDown,
}: Readonly<ThemeCardItemProps>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(card.id)}
      onPointerDown={onPointerDown}
      aria-pressed={isActive}
      className={`group relative text-left cursor-pointer focus:outline-none transition-all duration-200 hover:-translate-y-1.5 ${className}`}
      data-name={`ThemeCard · ${card.title}`}
    >
      <ThemeCardChrome isActive={isActive} />
      <ThemeCardBody card={card} isActive={isActive} />
    </button>
  );
}

function ThemePickerHeader({ dataset }: Readonly<{ dataset: string }>) {
  return (
    <div className="content-stretch flex flex-col md:flex-row items-start md:items-end justify-between gap-6 relative shrink-0 w-full">
      <div className="content-stretch flex flex-col font-medium gap-3 xl:gap-4 items-start relative shrink-0 text-[#f2f2f0]">
        <p className="font-mono font-medium leading-[1.2] relative shrink-0 text-[13px] xl:text-[15px] 2xl:text-[16px] tracking-[0.52px] uppercase">
          Earth themes · 4 real datasets
        </p>
        <h2 className="font-sans font-medium leading-[1.02] relative shrink-0 text-[36px] sm:text-[48px] xl:text-[56px] 2xl:text-[68px] tracking-[-0.03em]">
          Pick what Earth plays
        </h2>
      </div>

      <div className="content-stretch flex flex-col gap-3 xl:gap-4 items-start md:items-end relative shrink-0 w-full md:w-auto">
        <p className="font-mono font-normal leading-[1.3] relative shrink-0 text-[#f2f2f0] text-[11px] xl:text-[13px] tracking-[0.44px] uppercase whitespace-nowrap">
          Tap a card to change the sound
        </p>
        <TextLinkButton label="Pick a dataset →" href={`/listen?data=${dataset}`} />
      </div>
    </div>
  );
}

export function ThemePickerSection() {
  const { activeTheme, setActiveTheme } = useSonifyPlayer();
  const dataset = datasetForTheme(activeTheme);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Mouse drag state for smaller screen slider
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const dragDistanceRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;

    isDraggingRef.current = true;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftStartRef.current = el.scrollLeft;
    dragDistanceRef.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const el = trackRef.current;
    if (!el) return;

    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.15;
    dragDistanceRef.current = Math.abs(walk);
    el.scrollLeft = scrollLeftStartRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const handleCardSelect = (id: ThemeId) => {
    if (dragDistanceRef.current > 6) return;
    setActiveTheme(id);
  };

  return (
    <section
      className="content-stretch flex flex-col gap-6 sm:gap-8 items-start px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-16 pt-[60px] sm:pt-[80px] pb-4 sm:pb-6 relative shrink-0 w-full max-w-[1440px] xl:max-w-[1700px] 2xl:max-w-[2100px] min-[2200px]:max-w-[2500px] mx-auto overflow-hidden"
      data-name="Landing/Pick what Earth plays (theme picker)"
    >
      <ThemePickerHeader dataset={dataset} />

      {/* Super-wide desktop view (1680px+): 4 spacious scaled cards filling width */}
      <div className="hidden min-[1680px]:grid grid-cols-4 gap-8 2xl:gap-10 w-full items-stretch">
        {THEME_CARDS.map((card) => (
          <ThemeCardItem
            key={card.id}
            card={card}
            isActive={activeTheme === card.id}
            onSelect={setActiveTheme}
            className="w-full h-[490px] 2xl:h-[530px]"
          />
        ))}
      </div>

      {/* Slider view (<1680px: all desktop windows under 1680px, laptops, iPads, tablets, fold, mobile) */}
      <div className="block min-[1680px]:hidden w-full relative">
        <div
          ref={trackRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="no-scrollbar flex flex-row gap-6 items-stretch w-full overflow-x-auto scroll-smooth snap-x snap-mandatory py-4 px-2 select-none cursor-grab active:cursor-grabbing"
        >
          {THEME_CARDS.map((card) => (
            <div key={card.id} className="snap-start shrink-0">
              <ThemeCardItem
                card={card}
                isActive={activeTheme === card.id}
                onSelect={handleCardSelect}
                className="w-[320px] sm:w-[350px] md:w-[380px] lg:w-[400px] h-[450px] sm:h-[470px] lg:h-[490px]"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
