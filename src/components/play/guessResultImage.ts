export interface ResultImageRow {
  readonly name: string;
  readonly said: string;
  readonly correct: boolean;
  readonly values: readonly number[];
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
  const height = 1500;
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
  const rowHeight = 180;
  input.rows.slice(0, 5).forEach((row, index) => {
    const y = top + index * rowHeight;
    context.fillStyle = row.correct ? "#f2f2f0" : "#555555";
    context.fillRect(72, y, 8, 150);
    context.fillStyle = "#f2f2f0";
    context.font = "560 32px sans-serif";
    context.fillText(row.name, 100, y + 36);
    context.fillStyle = "#c8c6c2";
    context.font = "500 18px ui-monospace, monospace";
    const verdict = row.correct ? `NAMED · YOU SAID ${row.said}` : `MISSED · YOU SAID ${row.said}`;
    context.fillText(verdict, 100, y + 68);
    context.strokeStyle = "#f2f2f0";
    context.lineWidth = 2.5;
    trace(context, row.values, 100, y + 88, 980, 52);
    context.stroke();
  });

  context.fillStyle = "#c8c6c2";
  context.font = "500 20px ui-monospace, monospace";
  const maxWidth = width - 144;
  const words = input.url.split(/(?=\/)/);
  let line = "";
  let lineY = height - 108;
  words.forEach((word) => {
    const next = `${line}${word}`;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, 72, lineY);
      line = word;
      lineY += 28;
    } else {
      line = next;
    }
  });
  if (line) context.fillText(line, 72, lineY);

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
