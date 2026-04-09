"use client";

export async function createWatermarkedJpeg(file: File, label: string) {
  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }

  context.drawImage(imageBitmap, 0, 0);
  drawWatermark(context, canvas.width, canvas.height, label);

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
  label: string
) {
  const padding = Math.max(18, Math.round(width * 0.03));
  const fontSize = Math.max(18, Math.round(width * 0.045));
  const lineHeight = fontSize * 1.35;
  const stamp = `${label} • ${new Date().toISOString()}`;

  context.save();
  context.font = `600 ${fontSize}px Georgia, serif`;
  context.fillStyle = "rgba(255, 248, 240, 0.88)";
  context.strokeStyle = "rgba(25, 22, 18, 0.55)";
  context.lineWidth = Math.max(2, Math.round(fontSize * 0.08));
  context.textBaseline = "bottom";

  const metrics = context.measureText(stamp);
  const boxWidth = metrics.width + padding;
  const boxHeight = lineHeight + padding;
  const x = width - boxWidth - padding;
  const y = height - boxHeight - padding;

  context.fillStyle = "rgba(24, 20, 16, 0.4)";
  context.fillRect(x, y, boxWidth, boxHeight);
  context.strokeStyle = "rgba(255, 248, 240, 0.22)";
  context.strokeRect(x, y, boxWidth, boxHeight);

  context.fillStyle = "rgba(255, 248, 240, 0.92)";
  context.strokeStyle = "rgba(24, 20, 16, 0.35)";
  context.strokeText(stamp, x + padding / 2, y + boxHeight - padding / 2);
  context.fillText(stamp, x + padding / 2, y + boxHeight - padding / 2);

  context.restore();
}

function replaceExtension(filename: string, suffix: string) {
  const lastDot = filename.lastIndexOf(".");
  return lastDot === -1 ? `${filename}.${suffix}` : `${filename.slice(0, lastDot)}.${suffix}`;
}
