import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/process-rgs-one-logo.mjs <source.png>");
  process.exit(1);
}

const root = process.cwd();
const targets = [
  path.join(root, "public", "rgs-one-logo.png"),
  path.join(root, "public", "brand", "rgs-one-logo.png"),
];

const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

function isBackdrop(r, g, b, a) {
  if (a === 0) return false;

  // Solid black / near-black.
  if (r <= 28 && g <= 28 && b <= 28) return true;

  // Dark slate / navy leftover from letterhead processing (#0b1929, #08111c, etc.).
  // Keep saturated indigo from the ONE gradient (higher blue, more chroma).
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (max <= 55 && chroma <= 28 && b <= 70) return true;

  // Low-alpha dark fringe around previously keyed backgrounds.
  if (a < 40 && max <= 70 && chroma <= 24) return true;

  return false;
}

let cleared = 0;
for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const a = data[i + 3];

  if (isBackdrop(r, g, b, a)) {
    data[i + 3] = 0;
    cleared += 1;
  }
}

const processed = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png({ compressionLevel: 9 })
  .toBuffer();

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, processed);
  console.log("Wrote", target, `(${processed.length} bytes, cleared ${cleared} px)`);
}
