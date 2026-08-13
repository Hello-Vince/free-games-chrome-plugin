import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(root, "icons");
const sizes = [16, 32, 48, 128];
const scale = 4;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const target = y * (1 + width * 4);
    scanlines[target] = 0;
    pixels.copy(scanlines, target + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function makeCanvas(size) {
  const width = size * scale;
  const pixels = Buffer.alloc(width * width * 4);

  function paintPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= width || y >= width) return;
    const index = (Math.floor(y) * width + Math.floor(x)) * 4;
    const alpha = color[3] / 255;
    const inverse = 1 - alpha;
    pixels[index] = Math.round(color[0] * alpha + pixels[index] * inverse);
    pixels[index + 1] = Math.round(color[1] * alpha + pixels[index + 1] * inverse);
    pixels[index + 2] = Math.round(color[2] * alpha + pixels[index + 2] * inverse);
    pixels[index + 3] = Math.round((alpha + (pixels[index + 3] / 255) * inverse) * 255);
  }

  function roundedRect(x, y, boxWidth, boxHeight, radius, color) {
    const left = Math.round(x * scale);
    const top = Math.round(y * scale);
    const right = Math.round((x + boxWidth) * scale);
    const bottom = Math.round((y + boxHeight) * scale);
    const r = radius * scale;
    for (let py = top; py < bottom; py += 1) {
      for (let px = left; px < right; px += 1) {
        const dx = Math.max(left + r - px, 0, px - (right - r - 1));
        const dy = Math.max(top + r - py, 0, py - (bottom - r - 1));
        if (dx * dx + dy * dy <= r * r) paintPixel(px, py, color);
      }
    }
  }

  function circle(cx, cy, radius, color) {
    const centerX = cx * scale;
    const centerY = cy * scale;
    const r = radius * scale;
    for (let y = Math.floor(centerY - r); y <= Math.ceil(centerY + r); y += 1) {
      for (let x = Math.floor(centerX - r); x <= Math.ceil(centerX + r); x += 1) {
        if ((x - centerX) ** 2 + (y - centerY) ** 2 <= r ** 2) paintPixel(x, y, color);
      }
    }
  }

  return { width, pixels, roundedRect, circle };
}

function downsample(canvas, size) {
  const output = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const source = (((y * scale + sy) * canvas.width) + x * scale + sx) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            totals[channel] += canvas.pixels[source + channel];
          }
        }
      }
      const target = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        output[target + channel] = Math.round(totals[channel] / (scale * scale));
      }
    }
  }
  return output;
}

function drawIcon(size, background) {
  const canvas = makeCanvas(size);
  const white = [255, 255, 255, 255];
  const cutout = [...background, 255];
  const margin = size * 0.06;

  canvas.roundedRect(margin, margin, size - margin * 2, size - margin * 2, size * 0.23, [...background, 255]);

  // Gift box silhouette.
  canvas.roundedRect(size * 0.21, size * 0.43, size * 0.58, size * 0.34, size * 0.045, white);
  canvas.roundedRect(size * 0.17, size * 0.35, size * 0.66, size * 0.15, size * 0.045, white);
  canvas.roundedRect(size * 0.46, size * 0.35, size * 0.09, size * 0.42, size * 0.02, cutout);

  // Ribbon loops.
  canvas.circle(size * 0.39, size * 0.29, size * 0.12, white);
  canvas.circle(size * 0.61, size * 0.29, size * 0.12, white);
  canvas.circle(size * 0.40, size * 0.29, size * 0.055, cutout);
  canvas.circle(size * 0.60, size * 0.29, size * 0.055, cutout);
  return encodePng(size, size, downsample(canvas, size));
}

await mkdir(outputDirectory, { recursive: true });
for (const size of sizes) {
  await writeFile(resolve(outputDirectory, `bright-${size}.png`), drawIcon(size, [15, 118, 110]));
  await writeFile(resolve(outputDirectory, `muted-${size}.png`), drawIcon(size, [116, 132, 139]));
}

console.log(`Generated ${sizes.length * 2} icons in ${outputDirectory}`);
