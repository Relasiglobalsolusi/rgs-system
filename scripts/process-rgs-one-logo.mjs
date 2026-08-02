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
  path.join(root, "public", "brand", "rgs-one-logo.png"),
  path.join(root, "public", "rgs-one-logo.png"),
];

/**
 * Key only true black / fringe — keep charcoal RGS (~40,48,56) intact for light UI.
 */
function isBackdrop(r, g, b, a) {
  if (a === 0) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;

  // Solid black / near-black canvas only.
  if (max <= 18 && chroma <= 10) return true;

  // Soft fringe around previously keyed backgrounds.
  if (a < 35 && max <= 40 && chroma <= 12) return true;

  return false;
}

const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

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
  .trim({ threshold: 4 })
  .png({ compressionLevel: 9 })
  .toBuffer();

const meta = await sharp(processed).metadata();

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, processed);
  console.log(
    "Wrote",
    target,
    `(${meta.width}x${meta.height}, ${processed.length} bytes, cleared ${cleared} px)`
  );
}
