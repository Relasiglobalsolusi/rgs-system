import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DESKTOP = "C:\\Users\\Vicko Liem\\OneDrive\\Desktop";
const OUT_HTML = path.join(DESKTOP, "Product-Series-Catalog-Professional.html");
const OUT_ASSETS = path.join(DESKTOP, "assets");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// Clean old assets (removed bad hero crops)
if (fs.existsSync(OUT_ASSETS)) {
  fs.rmSync(OUT_ASSETS, { recursive: true, force: true });
}

fs.copyFileSync(path.join(ROOT, "product-series-catalog.html"), OUT_HTML);
fs.mkdirSync(OUT_ASSETS, { recursive: true });
fs.copyFileSync(path.join(ROOT, "assets", "rgs-logo.png"), path.join(OUT_ASSETS, "rgs-logo.png"));
copyDir(path.join(ROOT, "assets", "pages"), path.join(OUT_ASSETS, "pages"));

const pageCount = fs.readdirSync(path.join(OUT_ASSETS, "pages")).filter((f) => f.endsWith(".png")).length;
console.log(`Deployed: ${OUT_HTML}`);
console.log(`Assets: ${pageCount} pages + logo at ${OUT_ASSETS}`);
