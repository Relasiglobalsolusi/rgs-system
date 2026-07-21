import fs from "fs";
import path from "path";

const OUT = path.join(process.cwd(), "product-series-catalog.html");
const TOTAL_PDF_PAGES = 117;

const SECTIONS = [
  { num: "01", title: "Cleaning Machine Series", pages: "2–17", pdfStart: 1 },
  { num: "02", title: "Carpet & Sofa Cleaners / Vacuums", pages: "19–34", pdfStart: 18 },
  { num: "03", title: "Plastic Products", pages: "36–65", pdfStart: 35 },
  { num: "04", title: "High-Pressure Jet Sprayers", pages: "67–71", pdfStart: 66 },
  { num: "05", title: "Blowers", pages: "73–75", pdfStart: 72 },
  { num: "06", title: "Hand Dryers & Dispensers", pages: "77–105", pdfStart: 76 },
  { num: "07", title: "Lithium Electric Mowers", pages: "107–111", pdfStart: 106 },
  { num: "08", title: "Cleaning Chemicals", pages: "113–117", pdfStart: 112 },
];

function pageImg(n) {
  return `assets/pages/page-${String(n).padStart(3, "0")}.png`;
}

function catalogPage(n) {
  return `<div class="page sheet">
  <img class="sheet-img" src="${pageImg(n)}" alt="Catalog page ${n}" />
  <div class="sheet-footer">
    <img class="logo-xs" src="assets/rgs-logo.png" alt="RGS" />
    <span>PT Relasi Global Solusi · Product Catalog 2026 · Page ${n + 2}</span>
  </div>
</div>`;
}

const tocItems = SECTIONS.map(
  (s) =>
    `<li><span class="num">${s.num}</span><span class="title">${s.title}</span><span class="page-num">PDF p.${s.pdfStart}${s.pages.includes("–") ? "–" + s.pages.split("–")[1] : ""}</span></li>`
).join("\n    ");

const contentPages = Array.from({ length: TOTAL_PDF_PAGES }, (_, i) => catalogPage(i + 1)).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Product Series Catalog | PT Relasi Global Solusi</title>
  <style>
    :root {
      --bg: #0b0f14;
      --card: #151b22;
      --primary: #54bfb4;
      --purple: #586bb7;
      --text: #ffffff;
      --muted: #94a3b8;
      --subtle: #64748b;
      --border: rgba(255,255,255,0.06);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    @page portrait { size: A4 portrait; margin: 0; }
    @page landscape { size: A4 landscape; margin: 0; }

    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      background: #06090d;
      color: var(--text);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      margin: 12px auto;
      background: var(--bg);
      box-shadow: 0 8px 32px rgba(0,0,0,.45);
      position: relative;
      overflow: hidden;
    }

    .page.portrait {
      width: 210mm;
      min-height: 297mm;
      page: portrait;
    }

    .page.sheet {
      width: 297mm;
      min-height: 210mm;
      page: landscape;
      display: flex;
      flex-direction: column;
      padding: 0;
    }

    @media print {
      body { background: var(--bg); }
      .page {
        margin: 0;
        box-shadow: none;
        page-break-after: always;
        break-after: page;
      }
      .page:last-child { page-break-after: auto; }
    }

    .logo { height: 56px; width: auto; object-fit: contain; }
    .logo-lg { height: 80px; }
    .logo-xs { height: 18px; width: auto; opacity: .85; }

    .gradient-text {
      background: linear-gradient(135deg, var(--primary), var(--purple));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .gradient-bar { height: 4px; background: linear-gradient(90deg, var(--primary), var(--purple)); }

    /* Cover */
    .cover {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 48px 56px;
      background:
        radial-gradient(ellipse 80% 60% at 100% 0%, rgba(84,191,180,.12) 0%, transparent 60%),
        radial-gradient(ellipse 60% 50% at 0% 100%, rgba(88,107,183,.14) 0%, transparent 55%),
        var(--bg);
      min-height: 297mm;
    }

    .cover-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .cover-year {
      font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
      color: var(--subtle); padding: 6px 12px;
      border: 1px solid var(--border); border-radius: 999px;
    }
    .cover-center { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 40px 0; }
    .cover-tag { font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--primary); margin-bottom: 18px; font-weight: 600; }
    .cover h1 { font-size: 46px; font-weight: 700; line-height: 1.1; letter-spacing: -.03em; max-width: 520px; }
    .cover-sub { margin-top: 20px; font-size: 15px; color: var(--muted); max-width: 460px; line-height: 1.7; }
    .cover-bottom { border-top: 1px solid var(--border); padding-top: 22px; }
    .cover-contact { font-size: 12px; color: var(--muted); line-height: 1.8; }
    .cover-contact strong { color: var(--text); }

    /* TOC */
    .toc-page { padding: 44px 52px; min-height: 297mm; }
    .toc-page h2 { font-size: 28px; margin-bottom: 6px; }
    .toc-page .toc-sub { color: var(--muted); font-size: 13px; margin-bottom: 28px; }
    .toc-list { list-style: none; }
    .toc-list li {
      display: flex; align-items: baseline; padding: 10px 0;
      border-bottom: 1px solid var(--border); font-size: 13px;
    }
    .toc-list .num { color: var(--primary); font-weight: 700; width: 36px; flex-shrink: 0; }
    .toc-list .title { flex: 1; font-weight: 600; }
    .toc-list .page-num { color: var(--subtle); font-size: 12px; }
    .intro-note {
      margin-top: 28px; padding: 14px 18px; background: var(--card);
      border: 1px solid var(--border); border-left: 3px solid var(--primary);
      border-radius: 0 10px 10px 0; font-size: 12px; color: var(--muted); line-height: 1.7;
    }

    /* Full PDF sheet pages */
    .sheet-img {
      flex: 1;
      width: 100%;
      height: calc(210mm - 28px);
      object-fit: contain;
      background: #ffffff;
      display: block;
    }

    .sheet-footer {
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      background: var(--card);
      border-top: 1px solid var(--border);
      font-size: 8px;
      color: var(--subtle);
      letter-spacing: .04em;
    }
  </style>
</head>
<body>

<!-- COVER -->
<div class="page portrait cover">
  <div class="cover-top">
    <img class="logo logo-lg" src="assets/rgs-logo.png" alt="PT Relasi Global Solusi" />
    <span class="cover-year">2026 Edition</span>
  </div>
  <div class="cover-center">
    <span class="cover-tag">Equipment Catalog</span>
    <h1>Professional <span class="gradient-text">Cleaning</span> &amp; Facility Equipment</h1>
    <p class="cover-sub">Complete product series catalog — cleaning machines, vacuums, plastic products, jet sprayers, blowers, dispensers, and chemicals.</p>
  </div>
  <div class="cover-bottom">
    <div class="cover-contact">
      <strong>PT Relasi Global Solusi</strong><br />
      Jalan Daan Mogot KM 14.5, Ruko Point 8 Blok F6<br />
      Duri Kosambi, Cengkareng, West Jakarta, Indonesia<br />
      Tel: +62 21 2295 2228 &nbsp;|&nbsp; contact@rgs.co.id
    </div>
  </div>
</div>
<div class="gradient-bar" style="width:210mm;margin:0 auto;"></div>

<!-- TOC -->
<div class="page portrait toc-page">
  <img class="logo" src="assets/rgs-logo.png" alt="RGS" style="margin-bottom:28px;" />
  <h2>Table of Contents</h2>
  <p class="toc-sub">Product Series Catalog — Revised July 2026 · ${TOTAL_PDF_PAGES} product pages</p>
  <ul class="toc-list">
    ${tocItems}
  </ul>
  <div class="intro-note">
    <strong>Complete catalog.</strong> All ${TOTAL_PDF_PAGES} pages from the official product series are included with original product photos, specifications, and model numbers — presented with RGS branding.
  </div>
</div>

<!-- ALL PDF PAGES (1–117) -->
${contentPages}

<!-- BACK COVER -->
<div class="page portrait cover">
  <div class="cover-top">
    <img class="logo logo-lg" src="assets/rgs-logo.png" alt="PT Relasi Global Solusi" />
  </div>
  <div class="cover-center">
    <span class="cover-tag">Get in Touch</span>
    <h1>Reliable Equipment.<br /><span class="gradient-text">Professional</span> Results.</h1>
    <p class="cover-sub">For product inquiries, pricing, and technical specifications, contact our team today.</p>
  </div>
  <div class="cover-bottom">
    <div class="cover-contact">
      <strong>PT Relasi Global Solusi</strong><br />
      Tel: +62 21 2295 2228 · Email: contact@rgs.co.id
    </div>
  </div>
</div>

</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log(`Generated catalog with ${TOTAL_PDF_PAGES} full PDF pages + cover/TOC/back`);
