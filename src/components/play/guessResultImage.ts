export interface ResultImageRow {
  readonly name: string;
  readonly said: string;
  readonly source: string;
  readonly correct: boolean;
  readonly values: readonly number[];
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  const commit = () => {
    if (line.trim()) lines.push(line.trimEnd());
    line = "";
  };
  for (const token of text.split(/(\s+)/)) {
    if (!token) continue;
    if (context.measureText(line + token).width <= maxWidth) {
      line += token;
      continue;
    }
    commit();
    if (context.measureText(token).width <= maxWidth) {
      line = token.trimStart();
      continue;
    }
    let chunk = "";
    for (const char of token.trim()) {
      if (context.measureText(chunk + char).width > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk += char;
      }
    }
    line = chunk;
  }
  commit();
  return lines.length ? lines : [""];
}

function trace(context: CanvasRenderingContext2D, values: readonly number[], x: number, y: number, width: number, height: number) {
  if (values.length < 2) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  context.beginPath();
  values.forEach((value, index) => {
    const px = x + (index / (values.length - 1)) * width;
    const py = y + height - ((value - min) / span) * height;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  });
}

export async function saveGuessResultImage(input: {
  readonly title: string;
  readonly scoreLine: string;
  readonly url: string;
  readonly rows: readonly ResultImageRow[];
}): Promise<void> {
  const width = 1200;
  const height = 1760;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#141414";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#555555";
  context.lineWidth = 2;
  context.strokeRect(36, 36, width - 72, height - 72);

  context.fillStyle = "#f2f2f0";
  context.font = "600 28px ui-monospace, monospace";
  context.fillText("SONIFYSPHERE", 72, 110);
  context.fillStyle = "#c8c6c2";
  context.font = "600 18px ui-monospace, monospace";
  context.fillText("GUESS THE SIGNAL", 72, 142);

  context.fillStyle = "#f2f2f0";
  context.font = "560 64px sans-serif";
  context.fillText(input.title, 72, 240);
  context.font = "600 28px ui-monospace, monospace";
  context.fillText(input.scoreLine, 72, 290);

  const top = 340;
  const rowHeight = 230;
  const textWidth = width - 172;
  input.rows.slice(0, 5).forEach((row, index) => {
    const y = top + index * rowHeight;
    context.fillStyle = row.correct ? "#f2f2f0" : "#555555";
    context.fillRect(72, y, 8, rowHeight - 28);
    context.fillStyle = "#f2f2f0";
    context.font = "560 32px sans-serif";
    context.fillText(row.name, 100, y + 36);
    context.fillStyle = "#c8c6c2";
    context.font = "500 18px ui-monospace, monospace";
    const verdict = row.correct ? `NAMED · YOU SAID ${row.said}` : `MISSED · YOU SAID ${row.said}`;
    const verdictLines = wrapText(context, verdict, textWidth);
    verdictLines.forEach((line, lineIndex) => context.fillText(line, 100, y + 68 + lineIndex * 24));
    context.font = "500 16px ui-monospace, monospace";
    const sourceLines = wrapText(context, row.source, textWidth);
    sourceLines.forEach((line, lineIndex) => context.fillText(line, 100, y + 68 + verdictLines.length * 24 + lineIndex * 22));
    const curveTop = y + 68 + verdictLines.length * 24 + sourceLines.length * 22 + 8;
    context.strokeStyle = "#f2f2f0";
    context.lineWidth = 2.5;
    trace(context, row.values, 100, curveTop, 980, 48);
    context.stroke();
  });

  context.fillStyle = "#c8c6c2";
  context.font = "500 20px ui-monospace, monospace";
  const urlLines = wrapText(context, input.url, width - 144);
  urlLines.forEach((line, index) => context.fillText(line, 72, height - 120 + index * 28));

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = "sonifysphere-guess-result.png";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
