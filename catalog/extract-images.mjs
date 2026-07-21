import fs from "fs";
import path from "path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const PDF_PATH =
  "C:\\Users\\Vicko Liem\\OneDrive\\Desktop\\260714PRODUCT SERIES REVISI.pdf (2).pdf";
const OUT_DIR = path.join(process.cwd(), "assets", "products");
const PAGES_DIR = path.join(process.cwd(), "assets", "pages");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(PAGES_DIR, { recursive: true });

const PAGE_MAP = {
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

const data = new Uint8Array(fs.readFileSync(PDF_PATH));
const pdf = await getDocument({ data, useSystemFonts: true }).promise;

console.log(`PDF has ${pdf.numPages} pages`);

let imageIndex = 0;

for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  const pageFile = path.join(PAGES_DIR, `page-${String(pageNum).padStart(3, "0")}.png`);
  fs.writeFileSync(pageFile, canvas.toBuffer("image/png"));

  const ops = await page.getOperatorList();
  const objs = page.objs;

  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== 85) continue; // paintImageXObject
    const imgName = ops.argsArray[i][0];
    try {
      const img = await new Promise((resolve, reject) => {
        objs.get(imgName, (data) => {
          if (data) resolve(data);
          else reject(new Error(`Missing ${imgName}`));
        });
      });

      if (!img?.width || !img?.height || img.width < 80 || img.height < 80) continue;

      const imgCanvas = createCanvas(img.width, img.height);
      const imgCtx = imgCanvas.getContext("2d");
      const imageData = imgCtx.createImageData(img.width, img.height);
      imageData.data.set(img.data);
      imgCtx.putImageData(imageData, 0, 0);

      imageIndex += 1;
      const slug = PAGE_MAP[pageNum]?.[0] ?? `page-${pageNum}`;
      const file = path.join(
        OUT_DIR,
        `${slug}-img-${String(imageIndex).padStart(2, "0")}.png`
      );
      fs.writeFileSync(file, imgCanvas.toBuffer("image/png"));
    } catch {
      // skip unresolved images
    }
  }

  if (PAGE_MAP[pageNum]) {
    const slug = PAGE_MAP[pageNum].join("-");
    const heroFile = path.join(OUT_DIR, `${slug}-page.png`);
    fs.copyFileSync(pageFile, heroFile);
  }
}

console.log(`Extracted ${imageIndex} embedded images`);
console.log(`Rendered ${pdf.numPages} page previews`);
