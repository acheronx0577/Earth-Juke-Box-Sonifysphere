export interface RibbonImageTile {
  readonly title: string;
  readonly badge: string;
  readonly said: string;
  readonly points: number;
  readonly month: string;
  readonly samples: readonly [number, number][];
  readonly turn: readonly [number, number];
}

function loadedFamily(name: string): string | null {
  const face = [...document.fonts].find((entry) => entry.family.replace(/["']/g, "") === name && entry.status === "loaded");
  return face ? name : null;
}

function fontStack(): { sans: string; mono: string } {
  const sans = loadedFamily("GeistSans");
  const mono = loadedFamily("GeistMono");
  if (!sans) throw new Error("Geist is not available for the result image.");
  return { sans, mono: mono ?? sans };
}

function paintCurve(
  context: CanvasRenderingContext2D,
  samples: readonly [number, number][],
  turn: readonly [number, number],
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (samples.length < 2) return;
  const xs = samples.map((point) => point[0]);
  const ys = samples.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const plot = (point: readonly [number, number]) => [
    x + ((point[0] - minX) / spanX) * width,
    y + ((point[1] - minY) / spanY) * height,
  ];
  context.beginPath();
  samples.forEach((point, index) => {
    const [px, py] = plot(point);
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  });
  context.strokeStyle = "#f2f2f0";
  context.lineWidth = 3;
  context.stroke();
  const [tx, ty] = plot(turn);
  context.beginPath();
  context.arc(tx, ty, 6, 0, Math.PI * 2);
  context.fillStyle = "#f2f2f0";
  context.fill();
}

export function saveRibbonsResultImage(input: {
  readonly found: number;
  readonly total: number;
  readonly firstTries: number;
  readonly url: string;
  readonly tiles: readonly RibbonImageTile[];
}): string {
  const { sans, mono } = fontStack();

  const width = 1600;
  const height = 1000;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The result image could not be drawn.");
  context.fillStyle = "#141414";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#b4b2ae";
  context.font = `500 22px ${mono}`;
  context.fillText("CHALLENGE 03 · WAVEFORM RIBBONS", 72, 88);

  context.fillStyle = "#f2f2f0";
  context.font = `700 120px ${sans}`;
  context.fillText(`${input.found}/3`, 72, 230);
  context.font = `600 64px ${sans}`;
  context.fillText("turns", 360, 230);
  context.font = `700 120px ${sans}`;
  const score = String(input.total);
  const scoreWidth = context.measureText(score).width;
  context.fillText(score, width - 72 - scoreWidth, 230);
  context.fillStyle = "#b4b2ae";
  context.font = `500 22px ${mono}`;
  context.fillText("PTS", width - 72 - scoreWidth, 270);
  context.fillText(`FIRST TRY ${input.firstTries} OF 3`, width - 420, 270);

  input.tiles.slice(0, 3).forEach((tile, index) => {
    const left = 72 + index * 500;
    context.fillStyle = "#1c1c1c";
    context.fillRect(left, 330, 460, 520);
    context.strokeStyle = "#555555";
    context.lineWidth = 2;
    context.strokeRect(left, 330, 460, 520);
    context.fillStyle = "#b4b2ae";
    context.font = `500 20px ${mono}`;
    context.fillText(`${String(index + 1).padStart(2, "0")} · ${tile.month.toUpperCase()}`, left + 28, 378);
    context.fillText(tile.badge.toUpperCase(), left + 250, 378);
    context.fillStyle = "#f2f2f0";
    context.font = `600 40px ${sans}`;
    context.fillText(tile.title, left + 28, 440);
    paintCurve(context, tile.samples, tile.turn, left + 28, 480, 404, 220);
    context.fillStyle = "#b4b2ae";
    context.font = `500 18px ${mono}`;
    context.fillText("YOU SAID", left + 28, 760);
    context.fillStyle = "#f2f2f0";
    context.font = `500 28px ${sans}`;
    context.fillText(tile.said, left + 28, 802);
    context.font = `700 36px ${sans}`;
    const pts = `+${tile.points}`;
    context.fillText(pts, left + 460 - 28 - context.measureText(pts).width, 802);
  });

  context.fillStyle = "#b4b2ae";
  context.font = `500 20px ${mono}`;
  context.fillText(input.url, 72, 940);

  const href = canvas.toDataURL("image/png");
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "sonifysphere-waveform-ribbons-result.png";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return sans;
}
