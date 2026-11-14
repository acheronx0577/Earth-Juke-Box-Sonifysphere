"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { VoiceId } from "@/lib/voiceSettings";
import {
  DEFAULT_VOICE_SETTINGS,
  INSTRUMENTS,
  VOICE_ROWS,
  loadVoiceSettings,
  saveVoiceSettings,
  tempoLabel,
  type VoiceSetting,
  type VoiceSettings,
} from "@/lib/voiceSettings";
import { chamferClip } from "@/components/listen/chamfer";
import { ensureOrchestra, isOrchestraReady } from "@/lib/voiceSynth";

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7 1.2v1.6M7 11.2v1.6M1.2 7h1.6M11.2 7h1.6M2.8 2.8l1.1 1.1M10.1 10.1l1.1 1.1M11.2 2.8l-1.1 1.1M3.9 10.1l-1.1 1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="square"
      />
    </svg>
  );
}

function StepMeter({
  label,
  value,
  display,
  onChange,
}: Readonly<{ label: string; value: number; display: string; onChange: (value: number) => void }>) {
  return (
    <div className="flex items-center gap-2">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={value}
        aria-valuetext={display}
        className="flex h-8 w-24 cursor-ew-resize items-end gap-[3px]"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowUp") onChange(Math.min(10, value + 1));
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") onChange(Math.max(1, value - 1));
        }}
        onPointerDown={(event) => {
          const track = event.currentTarget;
          const apply = (clientX: number) => {
            const rect = track.getBoundingClientRect();
            const ratio = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
            onChange(Math.min(10, Math.max(1, Math.round(ratio * 9) + 1)));
          };
          apply(event.clientX);
          const move = (point: PointerEvent) => apply(point.clientX);
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      >
        {Array.from({ length: 10 }, (_, index) => (
          <span
            key={index}
            className={`block w-[6px] ${index < value ? "bg-[#f2f2f0]" : "bg-[rgba(242,242,240,0.22)]"}`}
            style={{ height: `${12 + (index % 3) * 4}px` }}
          />
        ))}
      </div>
      <span className="min-w-[44px] font-mono text-[11px] uppercase tracking-[0.04em] text-[rgba(242,242,240,0.7)]">
        {label}
        <span className="mt-0.5 block font-sans text-[14px] normal-case tracking-normal text-[#f2f2f0]">{display}</span>
      </span>
    </div>
  );
}

function VoiceRow({
  title,
  detail,
  setting,
  locked,
  onChange,
}: Readonly<{ title: string; detail: string; setting: VoiceSetting; locked: boolean; onChange: (next: VoiceSetting) => void }>) {
  const shell = chamferClip(8);
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 font-mono text-[11px] uppercase tracking-[0.4px] text-[#f2f2f0]">
        {title} <span className="font-sans text-[13px] normal-case tracking-normal text-[rgba(242,242,240,0.62)]">{detail}</span>
      </p>
      <div className="grid grid-cols-4 p-px" style={{ clipPath: shell, background: "#777777" }} role="radiogroup" aria-label={`${title} instrument`}>
        {INSTRUMENTS.map((item) => {
          const selected = setting.instrument === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={locked}
              onClick={() => onChange({ ...setting, instrument: item.id })}
              className={`cursor-pointer border-0 px-1 py-2 font-mono text-[11px] leading-[1.2] normal-case tracking-normal ${
                selected ? "bg-[#f2f2f0] text-[#141414]" : "bg-[#262626] text-[rgba(242,242,240,0.7)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4">
        <StepMeter
          label="Volume"
          value={setting.volume}
          display={`${setting.volume * 10}%`}
          onChange={(volume) => onChange({ ...setting, volume })}
        />
        <StepMeter
          label="Tempo"
          value={setting.tempo}
          display={tempoLabel(setting.tempo)}
          onChange={(tempo) => onChange({ ...setting, tempo })}
        />
      </div>
    </div>
  );
}

export function CustomizeButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="sonify-voice mb-1 inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.3px] text-[#f2f2f0]"
    >
      <GearIcon />
      Customize
    </button>
  );
}

export function CustomizeModal({ onClose }: Readonly<{ onClose: () => void }>) {
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(0);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setMounted(true);
    setSettings(loadVoiceSettings());
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const chooseStyle = (style: VoiceSettings["style"]) => {
    if (style === "synth") {
      setLoadError("");
      setSettings((prev) => {
        const next = { ...prev, style };
        saveVoiceSettings(next);
        return next;
      });
      return;
    }
    if (isOrchestraReady()) {
      setSettings((prev) => {
        const next = { ...prev, style: "orchestra" as const };
        saveVoiceSettings(next);
        return next;
      });
      return;
    }
    setLoadError("");
    setLoading(0.02);
    void ensureOrchestra(setLoading)
      .then(() => {
        setLoading(0);
        setSettings((prev) => {
          const next = { ...prev, style: "orchestra" as const };
          saveVoiceSettings(next);
          return next;
        });
      })
      .catch(() => {
        setLoading(0);
        setLoadError("The orchestra samples did not load. Synth is still available.");
      });
  };

  const updateVoice = (id: VoiceId, next: VoiceSetting) => {
    setSettings((prev) => {
      const voices = { ...prev.voices, [id]: next };
      const stored = { ...prev, style: "synth" as const, voices };
      saveVoiceSettings(stored);
      return stored;
    });
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(20,20,20,0.72)] p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-title"
        className="max-h-[calc(100dvh-32px)] w-full max-w-[460px] overflow-auto p-px"
        style={{ clipPath: chamferClip(12), background: "#777777" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-4 px-6 py-6" style={{ clipPath: chamferClip(11), background: "#262626" }}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="customize-title" className="m-0 font-sans text-[32px] font-medium tracking-[-0.03em] text-[#f2f2f0]">
              Customize
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close customize"
              className="grid size-10 cursor-pointer place-items-center border border-[#777777] bg-transparent text-[#f2f2f0]"
              style={{ clipPath: chamferClip(8) }}
            >
              ×
            </button>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="m-0 font-mono text-[11px] uppercase tracking-[0.4px] text-[#f2f2f0]">Sound style</p>
              <p className="m-0 mt-1 font-mono text-[10px] uppercase tracking-[0.3px] text-[rgba(242,242,240,0.55)]">Orchestra adds ~4 MB</p>
            </div>
            <div className="grid grid-cols-2 p-px" style={{ clipPath: chamferClip(8), background: "#777777" }} role="radiogroup" aria-label="Sound style">
              <button
                type="button"
                role="radio"
                aria-checked={settings.style === "synth"}
                onClick={() => chooseStyle("synth")}
                className={`cursor-pointer border-0 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.3px] ${
                  settings.style === "synth" ? "bg-[#f2f2f0] text-[#141414]" : "bg-[#262626] text-[rgba(242,242,240,0.7)]"
                }`}
              >
                Synth
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={settings.style === "orchestra"}
                aria-busy={loading > 0}
                onClick={() => chooseStyle("orchestra")}
                className={`cursor-pointer border-0 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.3px] ${
                  settings.style === "orchestra" ? "bg-[#f2f2f0] text-[#141414]" : "bg-[#262626] text-[rgba(242,242,240,0.7)]"
                }`}
              >
                Orchestra
              </button>
            </div>
          </div>
          {loading > 0 ? (
            <div role="status" aria-live="polite">
              <p className="m-0 mb-2 font-mono text-[11px] uppercase tracking-[0.04em] text-[rgba(242,242,240,0.75)]">
                Loading samples {Math.round(loading * 100)}%
              </p>
              <div
                className="h-0.5 w-full bg-[rgba(242,242,240,0.16)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(loading * 100)}
                aria-label="Loading samples"
              >
                <div className="h-full bg-[#f2f2f0]" style={{ width: `${Math.round(loading * 100)}%` }} />
              </div>
            </div>
          ) : null}
          <p className="m-0 font-mono text-[10px] leading-[1.4] tracking-[0.2px] text-[rgba(242,242,240,0.5)]">
            {loadError || "FluidR3 GM samples, MIT license. Loaded once, about 3.4 MB."}
          </p>

          {VOICE_ROWS.map((row) => (
            <VoiceRow
              key={row.id}
              title={row.title}
              detail={row.detail}
              setting={settings.voices[row.id]}
              locked={settings.style === "orchestra"}
              onChange={(next) => updateVoice(row.id, next)}
            />
          ))}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                saveVoiceSettings(DEFAULT_VOICE_SETTINGS);
                setSettings(DEFAULT_VOICE_SETTINGS);
              }}
              className="sonify-text-link cursor-pointer border-0 bg-transparent p-0 font-mono text-[12px] text-[rgba(242,242,240,0.7)]"
            >
              Reset to default
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer border-0 bg-[#f2f2f0] px-6 py-3 font-sans text-[16px] font-medium text-[#141414]"
              style={{ clipPath: chamferClip(10) }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
