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
  const titleSize = Math.max(18, Math.round(width * 0.038));
  const bodySize = Math.max(12, Math.round(width * 0.017));
  const titleLineHeight = titleSize * 1.25;
  const bodyLineHeight = bodySize * 1.25;
  const stamp = `${label} • ${new Date().toISOString()}`;
  const lines = [stamp, ...metadataLines];
  const maxLinesPerColumn = Math.max(8, Math.floor((height - padding * 2) / bodyLineHeight) - 2);
  const columns = chunkLines(lines.slice(1), maxLinesPerColumn);
  const columnCount = Math.max(1, columns.length);
  const panelWidth = Math.min(width - padding * 2, Math.max(width * 0.42, 280));
  const gap = Math.max(10, Math.round(bodySize * 0.65));
  const bodyTop = padding + titleLineHeight + gap;
  const bodyHeight = Math.min(
    height - padding * 2 - titleLineHeight - gap,
    Math.max(...columns.map((column) => column.length), 1) * bodyLineHeight + gap
  );
  const columnWidth = (panelWidth - gap * (columnCount - 1) - padding) / columnCount;

  context.save();
  const boxWidth = panelWidth + padding;
  const boxHeight = bodyTop + bodyHeight + padding / 2;
  const x = width - boxWidth - padding;
  const y = Math.max(padding, height - boxHeight - padding);

  context.fillStyle = "rgba(24, 20, 16, 0.4)";
  context.fillRect(x, y, boxWidth, boxHeight);
  context.strokeStyle = "rgba(255, 248, 240, 0.22)";
  context.strokeRect(x, y, boxWidth, boxHeight);

  context.textBaseline = "top";
  context.fillStyle = "rgba(255, 248, 240, 0.92)";
  context.strokeStyle = "rgba(24, 20, 16, 0.35)";
  context.lineWidth = Math.max(2, Math.round(titleSize * 0.06));
  context.font = `700 ${titleSize}px Georgia, serif`;
  context.strokeText(stamp, x + padding / 2, y + padding / 2);
  context.fillText(stamp, x + padding / 2, y + padding / 2);

  context.font = `500 ${bodySize}px "Courier New", monospace`;
  context.lineWidth = Math.max(1, Math.round(bodySize * 0.05));

  columns.forEach((column, columnIndex) => {
    column.forEach((line, lineIndex) => {
      const lineX = x + padding / 2 + columnIndex * (columnWidth + gap);
      const lineY = y + bodyTop + lineIndex * bodyLineHeight;
      context.strokeText(line, lineX, lineY);
      context.fillText(line, lineX, lineY);
    });
  });

  context.restore();
}

function replaceExtension(filename: string, suffix: string) {
  const lastDot = filename.lastIndexOf(".");
  return lastDot === -1 ? `${filename}.${suffix}` : `${filename.slice(0, lastDot)}.${suffix}`;
}

function chunkLines(lines: string[], size: number) {
  if (lines.length === 0) {
    return [[]];
  }

  const chunks: string[][] = [];

  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }

  return chunks;
}
