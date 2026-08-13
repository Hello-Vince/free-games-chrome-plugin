import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const expected = new Map([
  ["store/assets/icon-128.png", [128, 128]],
  ["store/assets/promo-440x280.png", [440, 280]],
  ["store/assets/screenshot-1-feed.png", [1280, 800]],
  ["store/assets/screenshot-2-filters.png", [1280, 800]],
  ["store/assets/screenshot-3-visited.png", [1280, 800]]
]);

function dimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error("Asset is not a PNG.");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function rgbaPixels(buffer) {
  const [width, height] = dimensions(buffer);
  const idatChunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }

  const scanlines = inflateSync(Buffer.concat(idatChunks));
  const rowLength = width * 4 + 1;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    if (scanlines[y * rowLength] !== 0) throw new Error("Store icon uses an unsupported PNG row filter.");
    scanlines.copy(pixels, y * width * 4, y * rowLength + 1, (y + 1) * rowLength);
  }
  return { width, height, pixels };
}

for (const [relativePath, wanted] of expected) {
  const buffer = await readFile(resolve(root, relativePath));
  const actual = dimensions(buffer);
  if (actual[0] !== wanted[0] || actual[1] !== wanted[1]) {
    throw new Error(`${relativePath} is ${actual.join("x")}; expected ${wanted.join("x")}.`);
  }
}

const icon = await readFile(resolve(root, "store/assets/icon-128.png"));
if (icon[25] !== 6) throw new Error("Store icon must be RGBA PNG with transparency.");
const decodedIcon = rgbaPixels(icon);
const opaqueBounds = { left: 128, top: 128, right: -1, bottom: -1 };
for (let y = 0; y < decodedIcon.height; y += 1) {
  for (let x = 0; x < decodedIcon.width; x += 1) {
    if (decodedIcon.pixels[(y * decodedIcon.width + x) * 4 + 3] === 0) continue;
    opaqueBounds.left = Math.min(opaqueBounds.left, x);
    opaqueBounds.top = Math.min(opaqueBounds.top, y);
    opaqueBounds.right = Math.max(opaqueBounds.right, x);
    opaqueBounds.bottom = Math.max(opaqueBounds.bottom, y);
  }
}
if (JSON.stringify(opaqueBounds) !== JSON.stringify({ left: 16, top: 16, right: 111, bottom: 111 })) {
  throw new Error(`Store icon artwork bounds are ${JSON.stringify(opaqueBounds)}; expected 16px padding.`);
}

console.log(`Verified ${expected.size} Chrome Web Store PNG assets.`);
