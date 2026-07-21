/**
 * Company identity constants shared by PDF letterhead, payment verification,
 * and other server paths that must not pull fs / pdfkit via pdf-letterhead.
 */

/** Exact copy from RGS Letterhead.docx header. */
export const LETTERHEAD = {
  legalName: "PT. Relasi Global Solusi",
  displayName: "Relasi Global Solusi",
  addressLines: [
    "Jl. Daan Mogot KM 14.5 Ruko Point 8, Blok F6",
    "RT 002 | RW 014, Jakarta Barat 11750",
  ],
  phone: "+62 21 2295 2228",
  email: "contact@rgs.co.id",
} as const;

export const LEGAL_COMPANY_NAME = LETTERHEAD.legalName;
export const DISPLAY_COMPANY_NAME = LETTERHEAD.displayName;
