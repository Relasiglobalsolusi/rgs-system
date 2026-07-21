import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const PRODUCTS_DIR = path.join(process.cwd(), "assets", "products");
const PAGES_DIR = path.join(process.cwd(), "assets", "pages");
const HERO_DIR = path.join(process.cwd(), "assets", "hero");
fs.mkdirSync(HERO_DIR, { recursive: true });

const PAGE_PRODUCTS = {
  2: ["sc-005", "sc-002"],
  3: ["sc-13", "sc-039"],
  4: ["a042", "a003"],
  5: ["sds-17"],
  6: ["mini-18"],
  7: ["bd1a"],
  8: ["sc-1500"],
  9: ["sc2a"],
  10: ["sc50d"],
  11: ["sc50c"],
  12: ["dtj5a"],
  13: ["dtj5ar"],
  14: ["dtj3a"],
  15: ["sp-cp-6180"],
  16: ["sa-660"],
  17: ["sa-600"],
  21: ["vacuum-spot"],
  22: ["backpack-3l", "backpack-5l"],
  23: ["ac-20sc"],
  24: ["ac-30sc"],
  25: ["sc-730", "sc-151n"],
  26: ["cb-01"],
  27: ["sc-301n"],
  28: ["sc-602j"],
  29: ["sc-80j-3"],
  30: ["cb15", "cb30"],
  34: ["gxc2a"],
};

function slugPrefix(pageNum) {
  const products = PAGE_PRODUCTS[pageNum];
  return products.length === 1 ? products[0] : products.join("-");
}

async function scoreImage(filePath) {
  const img = await loadImage(filePath);
  const w = img.width;
  const h = img.height;
  const area = w * h;
  const ratio = w / h;

  if (w < 140 || h < 140) return null;
  if (w > 1400 || h > 1400) return null;
  if (area < 40000) return null;
  if (ratio > 2.2 || ratio < 0.35) return null;

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);

  let alphaPixels = 0;
  let colorVariance = 0;
  let darkPixels = 0;
  const samples = Math.min(500, w * h);
  const step = Math.max(1, Math.floor((w * h) / samples));

  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 20) alphaPixels += 1;
    if (r + g + b < 60) darkPixels += 1;
    colorVariance += Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
  }

  const transparency = alphaPixels / samples;
  const avgVariance = colorVariance / samples;
  const darkness = darkPixels / samples;

  if (darkness > 0.85) return null;
  if (avgVariance < 10 && transparency < 0.04) return null;

  let score = area;
  if (transparency > 0.06) score *= 2;
  if (h > w && h > 280) score *= 1.3;
  if (avgVariance > 25) score *= 1.15;
  if (ratio > 0.5 && ratio < 1.8) score *= 1.1;

  return { filePath, score, w, h };
}

async function cropFromPage(pageNum, index, total) {
  const pageFile = path.join(PAGES_DIR, `page-${String(pageNum).padStart(3, "0")}.png`);
  const img = await loadImage(pageFile);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const top = Math.floor(img.height * 0.12);
  const bottom = Math.floor(img.height * 0.88);
  const usableHeight = bottom - top;

  let x, y, w, h;
  if (total === 1) {
    x = Math.floor(img.width * 0.08);
    w = Math.floor(img.width * 0.52);
    y = top;
    h = usableHeight;
  } else {
    const slotHeight = usableHeight / total;
    y = top + Math.floor(slotHeight * index);
    h = Math.floor(slotHeight * 0.92);
    x = Math.floor(img.width * 0.12);
    w = Math.floor(img.width * 0.48);
  }

  const crop = createCanvas(w, h);
  const cctx = crop.getContext("2d");
  cctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return crop.toBuffer("image/png");
}

const files = fs.readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith(".png") && f.includes("-img-"));

for (const [pageStr, products] of Object.entries(PAGE_PRODUCTS)) {
  const pageNum = Number(pageStr);
  const prefix = slugPrefix(pageNum);
  const candidates = files.filter((f) => f.startsWith(`${prefix}-img-`) || f.startsWith(`${products[0]}-img-`));

  const scored = [];
  for (const file of candidates) {
    const result = await scoreImage(path.join(PRODUCTS_DIR, file));
    if (result) scored.push(result);
  }
  scored.sort((a, b) => b.score - a.score);

  for (let i = 0; i < products.length; i++) {
    const slug = products[i];
    const dest = path.join(HERO_DIR, `${slug}.png`);
    const pick = scored[i] ?? scored[0];

    if (pick && pick.score > 80000) {
      fs.copyFileSync(pick.filePath, dest);
      console.log(`${slug} <- embedded ${path.basename(pick.filePath)} (${pick.w}x${pick.h})`);
    } else {
      const buf = await cropFromPage(pageNum, i, products.length);
      fs.writeFileSync(dest, buf);
      console.log(`${slug} <- cropped from page ${pageNum}`);
    }
  }
}

console.log("Done");
