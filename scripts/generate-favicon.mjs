import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const TEAL = "#54BFB4";

/** Teal concentric mark on transparent background (no black plate). */
function markSvg(size) {
  const pad = Math.round(size * 0.14);
  const outer = size - pad * 2;
  const outerR = Math.max(2, Math.round(outer * 0.22));
  const mid = Math.round(outer * 0.64);
  const midR = Math.max(1, Math.round(mid * 0.25));
  const inner = Math.round(outer * 0.36);
  const innerR = Math.max(1, Math.round(inner * 0.25));
  const ox = Math.round((size - outer) / 2);
  const mx = Math.round((size - mid) / 2);
  const ix = Math.round((size - inner) / 2);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <mask id="m">
      <rect width="${size}" height="${size}" fill="black"/>
      <rect x="${ox}" y="${ox}" width="${outer}" height="${outer}" rx="${outerR}" fill="white"/>
      <rect x="${mx}" y="${mx}" width="${mid}" height="${mid}" rx="${midR}" fill="black"/>
      <rect x="${ix}" y="${ix}" width="${inner}" height="${inner}" rx="${innerR}" fill="white"/>
    </mask>
  </defs>
  <rect width="${size}" height="${size}" fill="${TEAL}" mask="url(#m)"/>
</svg>`);
}

async function writePng(size, outPath) {
  await sharp(markSvg(size)).png().toFile(outPath);
  const { data, info } = await sharp(outPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let opaqueBlack = 0;
  let transparent = 0;
  let tealish = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 10) transparent++;
    else if (r < 30 && g < 30 && b < 30) opaqueBlack++;
    else if (g > 140 && b > 140 && r < 120) tealish++;
  }
  console.log(outPath, info.width + "x" + info.height, {
    opaqueBlack,
    transparent,
    tealish,
  });
}

await writePng(32, join(publicDir, "favicon-rgs.png"));
await writePng(180, join(publicDir, "apple-touch-icon-rgs.png"));
