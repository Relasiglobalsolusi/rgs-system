import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const PAGES_DIR = path.join(process.cwd(), "assets", "pages");
const HERO_DIR = path.join(process.cwd(), "assets", "hero");
fs.mkdirSync(HERO_DIR, { recursive: true });

/** pageNum -> [{ slug, crop: { x, y, w, h } as fractions of page }] */
const CROPS = {
  2: [
    { slug: "sc-005", crop: { x: 0.17, y: 0.16, w: 0.34, h: 0.38 } },
    { slug: "sc-002", crop: { x: 0.17, y: 0.50, w: 0.34, h: 0.38 } },
  ],
  3: [
    { slug: "sc-13", crop: { x: 0.17, y: 0.16, w: 0.34, h: 0.38 } },
    { slug: "sc-039", crop: { x: 0.17, y: 0.50, w: 0.34, h: 0.38 } },
  ],
  4: [
    { slug: "a042", crop: { x: 0.14, y: 0.14, w: 0.38, h: 0.40 } },
    { slug: "a003", crop: { x: 0.14, y: 0.52, w: 0.38, h: 0.38 } },
  ],
  5: [{ slug: "sds-17", crop: { x: 0.14, y: 0.14, w: 0.36, h: 0.72 } }],
  6: [{ slug: "mini-18", crop: { x: 0.12, y: 0.14, w: 0.40, h: 0.72 } }],
  7: [{ slug: "bd1a", crop: { x: 0.14, y: 0.14, w: 0.36, h: 0.72 } }],
  8: [{ slug: "sc-1500", crop: { x: 0.14, y: 0.14, w: 0.36, h: 0.72 } }],
  9: [{ slug: "sc2a", crop: { x: 0.10, y: 0.14, w: 0.44, h: 0.72 } }],
  10: [{ slug: "sc50d", crop: { x: 0.10, y: 0.14, w: 0.44, h: 0.72 } }],
  11: [{ slug: "sc50c", crop: { x: 0.10, y: 0.14, w: 0.44, h: 0.72 } }],
  12: [{ slug: "dtj5a", crop: { x: 0.10, y: 0.14, w: 0.44, h: 0.72 } }],
  13: [{ slug: "dtj5ar", crop: { x: 0.10, y: 0.14, w: 0.44, h: 0.72 } }],
  14: [{ slug: "dtj3a", crop: { x: 0.10, y: 0.14, w: 0.44, h: 0.72 } }],
  15: [{ slug: "sp-cp-6180", crop: { x: 0.14, y: 0.14, w: 0.36, h: 0.72 } }],
  16: [{ slug: "sa-660", crop: { x: 0.10, y: 0.14, w: 0.44, h: 0.72 } }],
  17: [{ slug: "sa-600", crop: { x: 0.10, y: 0.14, w: 0.44, h: 0.72 } }],
  21: [{ slug: "vacuum-spot", crop: { x: 0.08, y: 0.18, w: 0.48, h: 0.68 } }],
  22: [
    { slug: "backpack-3l", crop: { x: 0.10, y: 0.16, w: 0.36, h: 0.36 } },
    { slug: "backpack-5l", crop: { x: 0.10, y: 0.52, w: 0.36, h: 0.36 } },
  ],
  23: [{ slug: "ac-20sc", crop: { x: 0.10, y: 0.14, w: 0.40, h: 0.72 } }],
  24: [{ slug: "ac-30sc", crop: { x: 0.10, y: 0.14, w: 0.40, h: 0.72 } }],
  25: [
    { slug: "sc-730", crop: { x: 0.10, y: 0.16, w: 0.36, h: 0.36 } },
    { slug: "sc-151n", crop: { x: 0.10, y: 0.52, w: 0.36, h: 0.36 } },
  ],
  26: [{ slug: "cb-01", crop: { x: 0.10, y: 0.14, w: 0.40, h: 0.72 } }],
  27: [{ slug: "sc-301n", crop: { x: 0.10, y: 0.14, w: 0.44, h: 0.72 } }],
  28: [{ slug: "sc-602j", crop: { x: 0.10, y: 0.14, w: 0.44, h: 0.72 } }],
  29: [{ slug: "sc-80j-3", crop: { x: 0.10, y: 0.14, w: 0.44, h: 0.72 } }],
  30: [
    { slug: "cb15", crop: { x: 0.10, y: 0.16, w: 0.36, h: 0.36 } },
    { slug: "cb30", crop: { x: 0.10, y: 0.52, w: 0.36, h: 0.36 } },
  ],
  34: [{ slug: "gxc2a", crop: { x: 0.10, y: 0.14, w: 0.44, h: 0.72 } }],
};

async function cropHero(pageNum, { slug, crop }) {
  const pageFile = path.join(PAGES_DIR, `page-${String(pageNum).padStart(3, "0")}.png`);
  const img = await loadImage(pageFile);
  const x = Math.floor(img.width * crop.x);
  const y = Math.floor(img.height * crop.y);
  const w = Math.floor(img.width * crop.w);
  const h = Math.floor(img.height * crop.h);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

  const dest = path.join(HERO_DIR, `${slug}.png`);
  fs.writeFileSync(dest, canvas.toBuffer("image/png"));
  console.log(`${slug} cropped ${w}x${h} from page ${pageNum}`);
}

for (const [pageStr, items] of Object.entries(CROPS)) {
  for (const item of items) {
    await cropHero(Number(pageStr), item);
  }
}

console.log("All hero crops complete");
