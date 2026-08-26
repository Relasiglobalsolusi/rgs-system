/** Digits-only Kode dan Nomor Seri Faktur Pajak. */

const MIN_DIGITS = 13;
const MAX_DIGITS = 19;

const GROUPED_SERIAL =
  /\b(\d{3}[.\s]?\d{3}[-.\s]?\d{2}[-.\s]?\d{8})\b/;
const LABELED_SERIAL =
  /(?:kode\s+dan\s+nomor\s+seri\s+faktur(?:\s+pajak)?|nomor\s+(?:seri\s+)?faktur(?:\s+pajak)?|nsfp|tax\s+invoice\s+(?:no\.?|number)|nomor\s+faktur)\s*[:.\-–]?\s*([0-9][0-9.\s-]{11,24}[0-9])/i;

export function taxInvoiceSerialDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function formatTaxInvoiceSerial(digits: string): string {
  const clean = taxInvoiceSerialDigits(digits);
  if (clean.length === 16) {
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}-${clean.slice(6, 8)}.${clean.slice(8)}`;
  }
  return clean;
}

export function isPlausibleTaxInvoiceSerial(digits: string): boolean {
  return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS;
}

export function parseRequiredTaxInvoiceSerial(raw: unknown): string {
  const digits = taxInvoiceSerialDigits(String(raw ?? ""));
  if (!isPlausibleTaxInvoiceSerial(digits)) {
    throw new Error("Enter the Tax Invoice Number from the document.");
  }
  return digits;
}

export function requireTaxInvoiceSerialVerified(raw: unknown) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value !== "true" && value !== "on" && value !== "1") {
    throw new Error(
      "Confirm the Tax Invoice Number matches the document."
    );
  }
}

export function extractTaxInvoiceSerialFromText(text: string): string | null {
  const labeled = text.match(LABELED_SERIAL);
  if (labeled?.[1]) {
    const digits = taxInvoiceSerialDigits(labeled[1]);
    if (isPlausibleTaxInvoiceSerial(digits)) return digits;
  }
  const grouped = text.match(GROUPED_SERIAL);
  if (grouped?.[1]) {
    const digits = taxInvoiceSerialDigits(grouped[1]);
    if (isPlausibleTaxInvoiceSerial(digits)) return digits;
  }
  return null;
}

function decodePdfStringLiteral(raw: string): string {
  return raw.replace(/\\([()\\nrt])/g, (_, ch: string) => {
    if (ch === "n") return "\n";
    if (ch === "r") return "\r";
    if (ch === "t") return "\t";
    return ch;
  });
}

function pdfStringLiterals(raw: string): string {
  return [...raw.matchAll(/\((?:\\.|[^\\)]){3,80}\)/g)]
    .map((match) => decodePdfStringLiteral(match[0].slice(1, -1)))
    .join("\n");
}

async function inflatePdfBytes(bytes: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === "undefined") return null;
  for (const format of ["deflate", "deflate-raw"] as const) {
    try {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const stream = new Blob([copy]).stream().pipeThrough(
        new DecompressionStream(format)
      );
      const decompressed = await new Response(stream).arrayBuffer();
      return new TextDecoder("latin1").decode(decompressed);
    } catch {
      // Try the other PDF FlateDecode wrapper.
    }
  }
  return null;
}

function pdfStreamPayloads(latin1: string): Uint8Array[] {
  const payloads: Uint8Array[] = [];
  const bytes = Uint8Array.from(latin1, (ch) => ch.charCodeAt(0));
  const marker = "stream";
  const endMarker = "endstream";
  let from = 0;
  while (from < latin1.length) {
    const start = latin1.indexOf(marker, from);
    if (start < 0) break;
    if (start >= 3 && latin1.slice(start - 3, start) === "end") {
      from = start + marker.length;
      continue;
    }
    let dataStart = start + marker.length;
    if (latin1.startsWith("\r\n", dataStart)) dataStart += 2;
    else if (latin1[dataStart] === "\n" || latin1[dataStart] === "\r") {
      dataStart += 1;
    }
    const end = latin1.indexOf(endMarker, dataStart);
    if (end < 0) break;
    let dataEnd = end;
    if (latin1[dataEnd - 1] === "\n") dataEnd -= 1;
    if (latin1[dataEnd - 1] === "\r") dataEnd -= 1;
    if (dataEnd > dataStart && dataEnd - dataStart < 2_000_000) {
      payloads.push(bytes.subarray(dataStart, dataEnd));
    }
    from = end + endMarker.length;
  }
  return payloads;
}

async function decodePdfLikeText(bytes: Uint8Array): Promise<string> {
  const latin1 = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  const parts = [latin1, pdfStringLiterals(latin1)];
  for (const payload of pdfStreamPayloads(latin1)) {
    const inflated = await inflatePdfBytes(payload);
    if (!inflated) continue;
    parts.push(inflated, pdfStringLiterals(inflated));
  }
  return parts.join("\n");
}

export async function extractTaxInvoiceSerialFromFile(
  file: File
): Promise<string | null> {
  const buffer = await file.arrayBuffer();
  const text = await decodePdfLikeText(new Uint8Array(buffer));
  return extractTaxInvoiceSerialFromText(text);
}
