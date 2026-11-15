"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { LayerId, SeasonId } from "@/data/exploreMap";
import { chamferClip } from "@/components/listen/chamfer";

export function listenShareUrl(regionId: string, layer: LayerId, season: SeasonId): string {
  const data = layer === "methane" ? "ch4" : layer === "temperature" ? "temp" : "co2";
  const url = new URL("/listen/classic", window.location.origin);
  url.searchParams.set("region", regionId);
  url.searchParams.set("data", data);
  url.searchParams.set("theme", season);
  return url.toString();
}

const TARGETS = [
  { id: "email", label: "Email", glyph: "@" },
  { id: "messages", label: "Messages", glyph: "…" },
  { id: "x", label: "X", glyph: "X" },
  { id: "bluesky", label: "Bluesky", glyph: "B" },
  { id: "mastodon", label: "Mastodon", glyph: "M" },
  { id: "save", label: "Save", glyph: "↓" },
] as const;

function targetHref(id: (typeof TARGETS)[number]["id"], url: string, title: string): string | null {
  const text = encodeURIComponent(`${title} ${url}`);
  const encoded = encodeURIComponent(url);
  if (id === "email") return `mailto:?subject=${encodeURIComponent(title)}&body=${encoded}`;
  if (id === "x") return `https://twitter.com/intent/tweet?text=${text}`;
  if (id === "bluesky") return `https://bsky.app/intent/compose?text=${text}`;
  if (id === "mastodon") return `https://mastodon.social/share?text=${text}`;
  return null;
}

async function nativeShare(url: string, title: string): Promise<boolean> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  try {
    await navigator.share({ title, text: title, url });
    return true;
  } catch {
    return false;
  }
}

function downloadCard(regionName: string, detail: string): void {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#262626";
  context.fillRect(0, 0, 1200, 630);
  context.strokeStyle = "#f2f2f0";
  context.lineWidth = 2;
  context.strokeRect(48, 48, 1104, 534);
  context.beginPath();
  context.arc(220, 315, 70, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#f2f2f0";
  context.font = "500 64px Geist, sans-serif";
  context.fillText(regionName, 340, 280);
  context.font = "24px ui-monospace, monospace";
  context.fillText(detail, 340, 340);
  context.fillText("SonifySphere", 340, 400);
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "sonifysphere-listen.png";
  link.click();
}

export function ShareListenModal({
  regionId,
  regionName,
  layer,
  season,
  onClose,
}: Readonly<{
  regionId: string;
  regionName: string;
  layer: LayerId;
  season: SeasonId;
  onClose: () => void;
}>) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;
    const id = window.requestAnimationFrame(() => {
      if (active) setUrl(listenShareUrl(regionId, layer, season));
    });
    return () => {
      active = false;
      window.cancelAnimationFrame(id);
    };
  }, [mounted, layer, regionId, season]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = `${regionName} · SonifySphere`;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const openTarget = async (id: (typeof TARGETS)[number]["id"]) => {
    if (!url) return;
    if (id === "save") {
      downloadCard(regionName, url);
      return;
    }
    if (id === "messages") {
      const shared = await nativeShare(url, title);
      if (shared) return;
    }
    const href = targetHref(id, url, title);
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(20,20,20,0.72)] p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-listen-title"
        data-testid="share-listen"
        className="max-h-[calc(100dvh-32px)] w-full max-w-[600px] overflow-auto p-px"
        style={{ clipPath: chamferClip(16), background: "#777777" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-5 px-6 py-6 sm:px-8" style={{ background: "#262626" }}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="share-listen-title" className="m-0 font-sans text-[32px] font-medium tracking-[-0.03em] text-[#f2f2f0]">
              Share this listen
            </h2>
            <button type="button" aria-label="Close share" onClick={onClose} className="grid size-11 cursor-pointer place-items-center border border-[#777777] bg-transparent text-[22px] text-[#f2f2f0]" style={{ clipPath: chamferClip(8) }}>
              ×
            </button>
          </div>
          <div className="flex flex-wrap gap-4">
            {TARGETS.map((target) => (
              <button key={target.id} type="button" onClick={() => void openTarget(target.id)} className="flex w-16 cursor-pointer flex-col items-center gap-1 border-0 bg-transparent p-0 text-[#f2f2f0]">
                <span className="grid size-14 place-items-center font-sans text-[18px]" style={{ clipPath: chamferClip(8), background: "#262626", boxShadow: "inset 0 0 0 1px #777777" }}>
                  {target.glyph}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[rgba(242,242,240,0.7)]">{target.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 p-px" style={{ clipPath: chamferClip(10), background: "#777777" }}>
            <p className="m-0 min-w-0 flex-1 truncate px-3 font-mono text-[12px] text-[rgba(242,242,240,0.8)]" data-testid="share-listen-url" role="status" aria-busy={url ? undefined : true}>
              {url || "Preparing the link"}
            </p>
            <button type="button" onClick={() => void copy()} className="m-1 shrink-0 cursor-pointer border-0 bg-[#f2f2f0] px-4 py-3 font-sans text-[15px] font-medium text-[#141414]" style={{ clipPath: chamferClip(8) }}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <button type="button" onClick={() => downloadCard(regionName, `${regionName} · ${season}`)} className="cursor-pointer self-start border-0 bg-transparent p-0 text-left font-sans text-[16px] text-[#f2f2f0]">
            Download shareable image
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.3px] text-[rgba(242,242,240,0.55)]">PNG of this listen</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
