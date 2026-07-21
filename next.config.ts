import type { NextConfig } from "next";

const brandAssetGlobs = [
  "./public/brand/**/*",
  "./public/rgs-one-logo.png",
  "./assets/brand/**/*",
];

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Keep pdfkit / exceljs / xlsx outside the Turbopack bundle.
  // Bundling remaps native asset paths and can break runtime imports.
  serverExternalPackages: ["pdfkit", "exceljs", "xlsx"],
  // Logo paths are resolved at runtime via process.cwd(); include them in NFT.
  outputFileTracingIncludes: {
    "/api/reports/monthly-export": brandAssetGlobs,
    "/api/employees/bulk-template": brandAssetGlobs,
    "/api/clients/bulk-template": brandAssetGlobs,
    "/api/vendors/bulk-template": brandAssetGlobs,
    "/api/projects/bulk-template": brandAssetGlobs,
  },
};

export default nextConfig;
