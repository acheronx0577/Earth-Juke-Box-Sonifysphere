import type { VoiceStrip as VoiceStripKind } from "@/data/aboutData";

function RiseStrip() {
  return (
    <path
      d="M8 78 C 70 76, 120 70, 180 62 S 280 40, 360 22"
      fill="none"
      stroke="#f2f2f0"
      strokeWidth="1.5"
    />
  );
}

function SineStrip() {
  return (
    <path
      d="M8 48 C 28 18, 48 18, 68 48 S 108 78, 128 48 S 168 18, 188 48 S 228 78, 248 48 S 288 18, 308 48 S 348 78, 368 48"
      fill="none"
      stroke="#f2f2f0"
      strokeWidth="1.5"
    />
  );
}

function TickStrip() {
  const ticks = [12, 28, 40, 58, 74, 96, 112, 130, 148, 170, 188, 210, 228, 250, 268, 290, 312, 334, 352];
  return (
    <>
      {ticks.map((x, index) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1={78 - (index % 5) * 8}
          y2={82}
          stroke="#f2f2f0"
          strokeWidth="1.5"
        />
      ))}
    </>
  );
}

export function VoiceStrip({
  kind,
  label,
}: Readonly<{ kind: VoiceStripKind; label: string }>) {
  return (
    <svg viewBox="0 0 380 96" className="about-strip" role="img" aria-label={label}>
      {kind === "rise" && <RiseStrip />}
      {kind === "sine" && <SineStrip />}
      {kind === "ticks" && <TickStrip />}
    </svg>
  );
}
