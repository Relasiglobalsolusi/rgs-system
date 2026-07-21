import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_FILE = path.join(__dirname, "product-series-catalog.html");
const OUTPUT_PDF = "C:\\Users\\Vicko Liem\\OneDrive\\Desktop\\Product-Series-Catalog-2026.pdf";

if (!fs.existsSync(HTML_FILE)) {
  console.error("Missing HTML:", HTML_FILE);
  process.exit(1);
}

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  const fileUrl = `file:///${HTML_FILE.replace(/\\/g, "/")}`;

  await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 120000 });
  await page.emulateMediaType("print");

  await page.pdf({
    path: OUTPUT_PDF,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const stats = fs.statSync(OUTPUT_PDF);
  console.log(`PDF created: ${OUTPUT_PDF}`);
  console.log(`Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
} finally {
  await browser.close();
}
