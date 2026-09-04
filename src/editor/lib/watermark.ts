"use client";

const MINT = "#0c8c5e";
const TEXT = "#292524";
const BORDER = "#d6d3d1";

export async function addWatermarkToRasterDataUrl(
  dataUrl: string,
  width: number,
  height: number,
  text: string | undefined,
): Promise<string> {
  if (!text) return dataUrl;

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The exported diagram could not be watermarked."));
    image.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");
  context.drawImage(image, 0, 0, width, height);
  drawWatermark(context, width, height, text);
  return canvas.toDataURL("image/png");
}

export function addWatermarkToSvgDataUrl(
  dataUrl: string,
  width: number,
  height: number,
  text: string | undefined,
): string {
  if (!text) return dataUrl;
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return dataUrl;

  const metadata = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  const svg = metadata.includes(";base64") ? atob(payload) : decodeURIComponent(payload);
  const fontSize = watermarkFontSize(width, height);
  const paddingX = Math.round(fontSize * 0.7);
  const badgeHeight = Math.round(fontSize * 2.1);
  const badgeWidth = Math.round(text.length * fontSize * 0.58 + paddingX * 2 + fontSize * 0.9);
  const margin = Math.max(12, Math.round(fontSize));
  const x = Math.max(margin, width - badgeWidth - margin);
  const y = Math.max(margin, height - badgeHeight - margin);
  const radius = Math.round(fontSize * 0.45);
  const dotSize = Math.round(fontSize * 0.55);
  const overlay = `<g aria-label="${escapeXml(text)}"><rect x="${x}" y="${y}" width="${badgeWidth}" height="${badgeHeight}" rx="${radius}" fill="#ffffff" fill-opacity="0.92" stroke="${BORDER}"/><rect x="${x + paddingX}" y="${y + (badgeHeight - dotSize) / 2}" width="${dotSize}" height="${dotSize}" rx="${Math.round(dotSize * 0.25)}" fill="${MINT}"/><text x="${x + paddingX + dotSize + Math.round(fontSize * 0.5)}" y="${y + badgeHeight / 2}" dominant-baseline="middle" fill="${TEXT}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="${fontSize}" font-weight="600">${escapeXml(text)}</text></g>`;
  const watermarked = svg.replace(/<\/svg>\s*$/, `${overlay}</svg>`);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(watermarked)}`;
}

export function drawWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
): void {
  const fontSize = watermarkFontSize(width, height);
  const paddingX = Math.round(fontSize * 0.7);
  const paddingY = Math.round(fontSize * 0.55);
  const dotSize = Math.round(fontSize * 0.55);
  const dotGap = Math.round(fontSize * 0.5);
  const margin = Math.max(12, Math.round(fontSize));

  context.save();
  context.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  context.textBaseline = "middle";
  const textWidth = context.measureText(text).width;
  const badgeWidth = Math.ceil(paddingX * 2 + dotSize + dotGap + textWidth);
  const badgeHeight = Math.ceil(fontSize + paddingY * 2);
  const x = Math.max(margin, width - badgeWidth - margin);
  const y = Math.max(margin, height - badgeHeight - margin);
  const radius = Math.round(fontSize * 0.45);

  context.shadowColor = "rgba(41, 37, 36, 0.12)";
  context.shadowBlur = Math.max(4, Math.round(fontSize * 0.5));
  context.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.1));
  roundedRect(context, x, y, badgeWidth, badgeHeight, radius);
  context.fillStyle = "rgba(255, 255, 255, 0.92)";
  context.fill();
  context.shadowColor = "transparent";
  context.strokeStyle = BORDER;
  context.lineWidth = Math.max(1, Math.round(fontSize / 16));
  context.stroke();

  const dotX = x + paddingX;
  const dotY = y + (badgeHeight - dotSize) / 2;
  roundedRect(context, dotX, dotY, dotSize, dotSize, Math.round(dotSize * 0.25));
  context.fillStyle = MINT;
  context.fill();

  context.fillStyle = TEXT;
  context.fillText(text, dotX + dotSize + dotGap, y + badgeHeight / 2);
  context.restore();
}

function watermarkFontSize(width: number, height: number): number {
  return Math.max(12, Math.min(24, Math.round(Math.min(width, height) * 0.022)));
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
