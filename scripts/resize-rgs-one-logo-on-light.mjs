/**
 * Recompose rgs-one-logo-on-light.png onto the same 1024×682 canvas as the
 * dark-theme logo so both themes render at identical dimensions.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const darkPath = path.join(root, "public", "rgs-one-logo.png");
const lightPath = path.join(root, "public", "rgs-one-logo-on-light.png");
const targets = [
  lightPath,
  path.join(root, "public", "brand", "rgs-one-logo-on-light.png"),
];

const CANVAS_W = 1024;
const CANVAS_H = 682;
const ALPHA_THRESHOLD = 12;

async function getContentBounds(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > ALPHA_THRESHOLD) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0) {
    throw new Error("No opaque content found in image");
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

const darkMeta = await sharp(darkPath).metadata();
const lightMeta = await sharp(lightPath).metadata();
console.log("Dark:", darkMeta.width, "x", darkMeta.height);
console.log("Light (before):", lightMeta.width, "x", lightMeta.height);

const darkBounds = await getContentBounds(darkPath);
const lightBounds = await getContentBounds(lightPath);

console.log("Dark content bounds:", darkBounds);
console.log("Light content bounds:", lightBounds);

const lightContent = await sharp(lightPath)
  .extract({
    left: lightBounds.left,
    top: lightBounds.top,
    width: lightBounds.width,
    height: lightBounds.height,
  })
  .resize(darkBounds.width, darkBounds.height, { fit: "fill" })
  .png()
  .toBuffer();

const composed = await sharp({
  create: {
    width: CANVAS_W,
    height: CANVAS_H,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: lightContent, left: darkBounds.left, top: darkBounds.top }])
  .png({ compressionLevel: 9 })
  .toBuffer();

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, composed);
  console.log("Wrote", target, `(${composed.length} bytes)`);
}

const outMeta = await sharp(composed).metadata();
console.log("Light (after):", outMeta.width, "x", outMeta.height);
