import type { NextConfig } from "next";

const brandAssetGlobs = [
  "./public/brand/**/*",
  "./public/rgs-one-logo.png",
  "./public/rgs-one-logo-on-light.png",
  "./assets/brand/**/*",
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    return [
      { source: "/website", destination: "/dashboard", permanent: false },
      { source: "/departments", destination: "/employees", permanent: false },
    ];
  },
  // Keep pdfkit / exceljs / xlsx outside the Turbopack bundle.
  // Bundling remaps native asset paths and can break runtime imports.
  serverExternalPackages: ["pdfkit", "exceljs", "xlsx"],
  // Logo paths are resolved at runtime via process.cwd(); include them in NFT.
  outputFileTracingIncludes: {
    "/api/reports/project-monthly-export": brandAssetGlobs,
    "/api/reports/attendance-export": brandAssetGlobs,
    "/api/inventory/bulk-template": brandAssetGlobs,
  },
};

export default nextConfig;
