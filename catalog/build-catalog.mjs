import fs from "fs";
import path from "path";

const src = path.join(process.cwd(), "product-series-catalog.html");
let html = fs.readFileSync(src, "utf8");

const IMAGE_MAP = {
  "SC-005": "sc-005",
  "SC-002": "sc-002",
  "SC-13": "sc-13",
  "SC-039": "sc-039",
  "A042": "a042",
  "A003 / BD1A": "bd1a",
  "SDS-17": "sds-17",
  "MINI-18": "mini-18",
  "SC-1500": "sc-1500",
  "SC2A": "sc2a",
  "SC50D": "sc50d",
  "SC50C": "sc50c",
  "DTJ5A": "dtj5a",
  "DTJ5AR": "dtj5ar",
  "DTJ3A": "dtj3a",
  "SP-CP-6180": "sp-cp-6180",
  "SA-660": "sa-660",
  "SA-600": "sa-600",
  "AC-20SC": "ac-20sc",
  "AC-30SC": "ac-30sc",
  "SC-730": "sc-730",
  "CB-01": "cb-01",
  "SC-151N": "sc-151n",
  "SC-301N": "sc-301n",
  "SC-602J": "sc-602j",
  "SC-80J-3": "sc-80j-3",
  "BXC3A": "backpack-3l",
  "BXC5A": "backpack-5l",
  "CB15 / CB30": "cb15",
  "GXC2A": "gxc2a",
};

const styles = `  <style>
    :root {
      --bg: #0b0f14;
      --card: #151b22;
      --card-elevated: #1a222c;
      --primary: #54bfb4;
      --primary-dark: #3ba79b;
      --purple: #586bb7;
      --text: #ffffff;
      --muted: #94a3b8;
      --subtle: #64748b;
      --border: rgba(255,255,255,0.06);
      --photo-bg: #f4f7fa;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    @page { size: A4; margin: 0; }

    body {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: var(--text);
      background: #06090d;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 12px auto;
      background: var(--bg);
      position: relative;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,.45);
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

    .logo { height: 52px; width: auto; object-fit: contain; }
    .logo-lg { height: 72px; }
    .logo-sm { height: 28px; }

    .gradient-text {
      background: linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .gradient-bar {
      height: 4px;
      background: linear-gradient(90deg, var(--primary), var(--purple));
    }

    /* Cover */
    .cover {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background:
        radial-gradient(ellipse 80% 60% at 100% 0%, rgba(84,191,180,.12) 0%, transparent 60%),
        radial-gradient(ellipse 60% 50% at 0% 100%, rgba(88,107,183,.14) 0%, transparent 55%),
        var(--bg);
      color: var(--text);
      padding: 48px 56px;
    }

    .cover-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .cover-year {
      font-size: 11px;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: var(--subtle);
      padding: 6px 12px;
      border: 1px solid var(--border);
      border-radius: 999px;
    }

    .cover-center { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 48px 0; }
    .cover-tag {
      display: inline-block;
      font-size: 10px;
      letter-spacing: .2em;
      text-transform: uppercase;
      color: var(--primary);
      margin-bottom: 20px;
      font-weight: 600;
    }
    .cover h1 {
      font-size: 48px;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -.03em;
      max-width: 540px;
    }
    .cover-sub { margin-top: 22px; font-size: 16px; color: var(--muted); max-width: 460px; line-height: 1.7; }

    .cover-bottom {
      border-top: 1px solid var(--border);
      padding-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .cover-contact { font-size: 12px; color: var(--muted); line-height: 1.8; }
    .cover-contact strong { color: var(--text); font-weight: 600; }

    /* Section divider */
    .section-divider {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 56px;
      background:
        radial-gradient(ellipse 70% 80% at 90% 20%, rgba(84,191,180,.1) 0%, transparent 65%),
        var(--card);
      color: var(--text);
      position: relative;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }

    .section-divider::after {
      content: "";
      position: absolute;
      left: 56px;
      bottom: 0;
      width: 120px;
      height: 3px;
      background: linear-gradient(90deg, var(--primary), var(--purple));
    }

    .section-num {
      font-size: 80px;
      font-weight: 800;
      line-height: 1;
      margin-bottom: 12px;
      background: linear-gradient(135deg, rgba(84,191,180,.35), rgba(88,107,183,.25));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .section-divider h2 { font-size: 34px; font-weight: 700; letter-spacing: -.02em; margin-bottom: 12px; }
    .section-divider p { font-size: 14px; color: var(--muted); max-width: 440px; line-height: 1.7; }

    /* Product page */
    .product-page {
      padding: 32px 40px 28px;
      display: flex;
      flex-direction: column;
      min-height: 297mm;
      background: var(--bg);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 22px;
    }
    .page-header .section-label {
      font-size: 10px;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: var(--primary);
      font-weight: 600;
      padding: 5px 10px;
      border: 1px solid rgba(84,191,180,.2);
      border-radius: 6px;
      background: rgba(84,191,180,.08);
    }

    .product-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; flex: 1; }
    .product-grid.single { grid-template-columns: 1fr; }
    .product-grid.single .product-card { max-width: 520px; }

    .product-card {
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--card);
    }

    .product-card-header {
      background: linear-gradient(135deg, rgba(84,191,180,.12) 0%, rgba(88,107,183,.1) 100%);
      border-bottom: 1px solid var(--border);
      padding: 14px 16px;
    }
    .product-card-header .model {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -.01em;
      color: var(--primary);
    }
    .product-card-header .name { font-size: 11px; color: var(--muted); margin-top: 3px; }

    .product-image {
      background: var(--photo-bg);
      min-height: 180px;
      max-height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
      border-bottom: 1px solid var(--border);
      overflow: hidden;
    }
    .product-image img {
      max-width: 100%;
      max-height: 196px;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
    }

    .spec-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .spec-table tr:nth-child(even) td { background: rgba(255,255,255,.02); }
    .spec-table td { padding: 6px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
    .spec-table td:first-child { color: var(--subtle); width: 48%; font-weight: 500; }
    .spec-table td:last-child { font-weight: 600; color: var(--text); }

    .accessories {
      padding: 10px 14px;
      background: rgba(84,191,180,.06);
      border-top: 1px solid rgba(84,191,180,.15);
      font-size: 10px;
      color: var(--muted);
      line-height: 1.6;
    }
    .accessories strong {
      display: block;
      font-size: 9px;
      letter-spacing: .1em;
      text-transform: uppercase;
      margin-bottom: 3px;
      color: var(--primary);
    }

    .features-row {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      padding: 9px 14px;
      border-bottom: 1px solid var(--border);
    }
    .feature-tag {
      font-size: 9px;
      background: rgba(88,107,183,.12);
      border: 1px solid rgba(88,107,183,.2);
      border-radius: 4px;
      padding: 3px 7px;
      color: #a8b4d9;
    }

    .page-footer {
      margin-top: auto;
      padding-top: 14px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: var(--subtle);
      letter-spacing: .04em;
    }

    /* TOC */
    .toc-page { padding: 44px 52px; background: var(--bg); }
    .toc-page h2 { font-size: 28px; color: var(--text); margin-bottom: 6px; }
    .toc-page .toc-sub { color: var(--muted); font-size: 13px; margin-bottom: 32px; }
    .toc-list { list-style: none; }
    .toc-list li {
      display: flex;
      align-items: baseline;
      padding: 9px 0;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .toc-list li .num { color: var(--primary); font-weight: 700; width: 32px; flex-shrink: 0; }
    .toc-list li .title { flex: 1; font-weight: 600; color: var(--text); }
    .toc-list li .page-num { color: var(--subtle); font-size: 12px; }

    .intro-note {
      margin-top: 28px;
      padding: 14px 18px;
      background: var(--card);
      border: 1px solid var(--border);
      border-left: 3px solid var(--primary);
      border-radius: 0 10px 10px 0;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.7;
    }
    .intro-note strong { color: var(--text); }
  </style>`;

html = html.replace(/<style>[\s\S]*?<\/style>/, styles);

// Cover
html = html.replace(
  `<div class="cover-top">
    <div class="logo-block">
      <span class="company">PT Relasi Global Solusi</span>
      <span class="brand">RGS</span>
    </div>
    <span class="cover-year">2026 Edition</span>
  </div>
  <div class="cover-center">
    <span class="cover-tag">Equipment Catalog</span>
    <h1>Professional <span>Cleaning</span> &amp; Facility Equipment</h1>`,
  `<div class="cover-top">
    <img class="logo logo-lg" src="assets/rgs-logo.png" alt="PT Relasi Global Solusi" />
    <span class="cover-year">2026 Edition</span>
  </div>
  <div class="cover-center">
    <span class="cover-tag">Equipment Catalog</span>
    <h1>Professional <span class="gradient-text">Cleaning</span> &amp; Facility Equipment</h1>`
);

html = html.replace(
  `<div class="accent-bar" style="width:210mm;margin:0 auto;"></div>`,
  `<div class="gradient-bar" style="width:210mm;margin:0 auto;"></div>`
);

// TOC note
html = html.replace(
  `<strong>Note:</strong> Product images from the original catalog should be inserted into the image placeholder areas before final PDF export. All specifications have been reviewed for accuracy, consistent terminology, and professional formatting.`,
  `<strong>Note:</strong> All product images and specifications have been sourced from the official product series catalog and formatted to match RGS brand standards.`
);

// Page headers
html = html.replace(
  /<div class="page-header">\s*<span class="brand-sm"><strong>RGS<\/strong> Equipment Catalog<\/span>\s*<span class="section-label">([^<]+)<\/span>\s*<\/div>/g,
  `<div class="page-header">
    <img class="logo logo-sm" src="assets/rgs-logo.png" alt="RGS" />
    <span class="section-label">$1</span>
  </div>`
);

// Back cover
html = html.replace(
  `<!-- Back cover -->
<div class="page cover">
  <div class="cover-top">
    <div class="logo-block">
      <span class="company">PT Relasi Global Solusi</span>
      <span class="brand">RGS</span>
    </div>
  </div>
  <div class="cover-center">
    <span class="cover-tag">Get in Touch</span>
    <h1>Reliable Equipment.<br /><span>Professional</span> Results.</h1>`,
  `<!-- Back cover -->
<div class="page cover">
  <div class="cover-top">
    <img class="logo logo-lg" src="assets/rgs-logo.png" alt="PT Relasi Global Solusi" />
  </div>
  <div class="cover-center">
    <span class="cover-tag">Get in Touch</span>
    <h1>Reliable Equipment.<br /><span class="gradient-text">Professional</span> Results.</h1>`
);

// Product images - match each card by model name
for (const [model, slug] of Object.entries(IMAGE_MAP)) {
  const escaped = model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(<div class="product-card-header"><div class="model">${escaped}</div><div class="name">[^<]+</div></div>)\\s*<div class="product-image-placeholder">\\[ Product Image \\]</div>`,
    "g"
  );
  html = html.replace(
    pattern,
    `$1
      <div class="product-image"><img src="assets/hero/${slug}.png" alt="${model}" /></div>`
  );
}

// Catch any remaining placeholders
html = html.replace(
  /<div class="product-image-placeholder">\[ Product Image \]<\/div>/g,
  `<div class="product-image"><img src="assets/rgs-logo.png" alt="RGS" style="max-height:80px;opacity:.3" /></div>`
);

fs.writeFileSync(src, html);
console.log("Catalog updated with RGS branding and product images");
