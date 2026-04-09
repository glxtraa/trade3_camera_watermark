"use client";

export async function createWatermarkedJpeg(file: File, label: string, metadataLines: string[]) {
  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }

  context.drawImage(imageBitmap, 0, 0);
  drawWatermark(context, canvas.width, canvas.height, label, metadataLines);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
        return;
      }

      reject(new Error("Failed to render watermark."));
    }, "image/jpeg", 0.92);
  });

  return new File([blob], replaceExtension(file.name, "watermarked.jpg"), {
    type: "image/jpeg"
  });
}

function drawWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  label: string,
  metadataLines: string[]
) {
  const padding = Math.max(18, Math.round(width * 0.03));
  const titleSize = Math.max(20, Math.round(width * 0.042));
  const bodySize = Math.max(14, Math.round(width * 0.022));
  const titleLineHeight = titleSize * 1.25;
  const bodyLineHeight = bodySize * 1.35;
  const stamp = `${label} • ${new Date().toISOString()}`;
  const panelWidth = Math.min(width - padding * 2, Math.max(width * 0.68, 320));
  const wrappedTitle = wrapLine(context, stamp, panelWidth - padding, `700 ${titleSize}px Georgia, serif`);
  const bodyLines = metadataLines.flatMap((line) =>
    wrapLine(context, line, panelWidth - padding, `600 ${bodySize}px "Courier New", monospace`)
  );
  const visibleBodyLines = bodyLines.slice(0, 9);
  const gap = Math.max(12, Math.round(bodySize * 0.8));
  const bodyTop = padding + wrappedTitle.length * titleLineHeight + gap;
  const bodyHeight = Math.max(visibleBodyLines.length, 1) * bodyLineHeight + gap;

  context.save();
  const boxWidth = panelWidth + padding;
  const boxHeight = bodyTop + bodyHeight + padding / 2;
  const x = padding;
  const y = padding;

  context.fillStyle = "rgba(24, 20, 16, 0.56)";
  context.fillRect(x, y, boxWidth, boxHeight);
  context.strokeStyle = "rgba(255, 248, 240, 0.34)";
  context.strokeRect(x, y, boxWidth, boxHeight);

  context.textBaseline = "top";
  context.fillStyle = "rgba(255, 248, 240, 0.92)";
  context.strokeStyle = "rgba(24, 20, 16, 0.35)";
  context.lineWidth = Math.max(2, Math.round(titleSize * 0.06));
  context.font = `700 ${titleSize}px Georgia, serif`;
  wrappedTitle.forEach((line, index) => {
    const lineY = y + padding / 2 + index * titleLineHeight;
    context.strokeText(line, x + padding / 2, lineY);
    context.fillText(line, x + padding / 2, lineY);
  });

  context.font = `500 ${bodySize}px "Courier New", monospace`;
  context.lineWidth = Math.max(1, Math.round(bodySize * 0.05));

  visibleBodyLines.forEach((line, lineIndex) => {
    const lineY = y + bodyTop + lineIndex * bodyLineHeight;
    context.strokeText(line, x + padding / 2, lineY);
    context.fillText(line, x + padding / 2, lineY);
  });

  context.restore();
}

function replaceExtension(filename: string, suffix: string) {
  const lastDot = filename.lastIndexOf(".");
  return lastDot === -1 ? `${filename}.${suffix}` : `${filename.slice(0, lastDot)}.${suffix}`;
}

function wrapLine(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  font: string
) {
  context.save();
  context.font = font;

  const words = value.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || currentLine === "") {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  context.restore();
  return lines;
}
