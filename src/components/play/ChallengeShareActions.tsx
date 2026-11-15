"use client";

import { useState } from "react";
import { CutButton } from "@/components/play/CutControls";

type ChallengeShareActionsProps = Readonly<{
  readonly path: string;
  readonly params: Readonly<Record<string, string>>;
  readonly title: string;
  readonly score: string;
  readonly detail: string;
  readonly fileName: string;
  readonly copyLink?: boolean;
}>;

function resultUrl(path: string, params: Readonly<Record<string, string>>): string {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function drawWrappedLine(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
  const words = text.trim().split(/\s+/);
  let line = "";
  let lineNumber = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      context.fillText(line, x, y + lineNumber * lineHeight);
      line = word;
      lineNumber += 1;
      if (lineNumber === 2) break;
    } else {
      line = candidate;
    }
  }
  if (line && lineNumber < 2) {
    if (context.measureText(line).width > maxWidth) {
      while (line.length > 1 && context.measureText(`${line}…`).width > maxWidth) line = line.slice(0, -1);
      line = `${line}…`;
    }
    context.fillText(line, x, y + lineNumber * lineHeight);
  }
}

async function createResultImage(title: string, score: string, detail: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not create the result image.");

  context.fillStyle = "#141414";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(242, 242, 240, 0.35)";
  context.lineWidth = 2;
  context.strokeRect(32, 32, canvas.width - 64, canvas.height - 64);

  context.fillStyle = "#aaaaaa";
  context.font = "600 22px ui-monospace, monospace";
  context.fillText("SONIFYSPHERE · CHALLENGE RESULT", 72, 102);

  context.fillStyle = "#f2f2f0";
  context.font = "600 54px Arial, sans-serif";
  drawWrappedLine(context, title, 72, 190, 1040, 64);

  context.fillStyle = "#f2f2f0";
  context.font = "700 104px Arial, sans-serif";
  drawWrappedLine(context, score, 72, 356, 1040, 112);

  context.fillStyle = "rgba(242, 242, 240, 0.72)";
  context.font = "24px ui-monospace, monospace";
  drawWrappedLine(context, detail, 72, 450, 1040, 34);

  context.fillStyle = "#aaaaaa";
  context.font = "500 20px Arial, sans-serif";
  context.fillText("Play with Earth data at SonifySphere", 72, 546);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Your browser could not export the result image. Try again or use the share link."));
    }, "image/png");
  });
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Clipboard access was blocked. Select and copy the link below.");
}

export function ChallengeShareActions({
  path,
  params,
  title,
  score,
  detail,
  fileName,
  copyLink = true,
}: ChallengeShareActionsProps) {
  const [shareUrl, setShareUrl] = useState("");
  const [status, setStatus] = useState("");

  const copyResultLink = async () => {
    const url = resultUrl(path, params);
    setShareUrl(url);
    try {
      await copyText(url);
      setStatus("Result link copied.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The result link could not be copied.");
    }
  };

  const downloadResultImage = async () => {
    try {
      const blob = await createResultImage(title, score, detail);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setStatus("Result image downloaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The result image could not be created.");
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Share your result">
      <div className="flex flex-wrap gap-3">
        {copyLink ? (
          <CutButton onClick={() => void copyResultLink()}>
            Copy result link
          </CutButton>
        ) : null}
        <CutButton onClick={() => void downloadResultImage()}>
          Download result image
        </CutButton>
      </div>
      {shareUrl ? (
        <label className="flex min-w-0 flex-col gap-2 font-mono text-xs text-[rgba(242,242,240,0.7)]">
          <span>Shareable result link</span>
          <input
            readOnly
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 border border-[rgba(242,242,240,0.2)] bg-[#141414] px-3 py-2 text-[#f2f2f0]"
          />
        </label>
      ) : null}
      <p className="m-0 min-h-5 font-mono text-xs text-[rgba(242,242,240,0.7)]" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
