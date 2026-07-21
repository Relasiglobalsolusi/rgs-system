import { access, constants, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const DEFAULT_PART_MAX = 48;
const CLIENT_CODE_MAX = 12;
const INVOICE_REF_MAX = 28;
const BASENAME_MAX = 100;

export type SaveUploadOptions = {
  /**
   * Descriptive basename without extension, e.g.
   * Tax-Invoice_C001_INV-202607-ABC123
   */
  fileBaseName?: string;
};

/** Strip filesystem-illegal characters, collapse whitespace, trim length. */
export function sanitizeFilenamePart(
  value: string,
  maxLength = DEFAULT_PART_MAX
): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");

  if (!cleaned) return "Unknown";
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).replace(/[-_.]+$/g, "") || "Unknown";
}

/**
 * Prefer keeping the trailing unique segment when invoice refs are long
 * (e.g. suffix after the last hyphen), capped at maxLength.
 */
export function shortenInvoiceRefPart(
  value: string,
  maxLength = INVOICE_REF_MAX
): string {
  const cleaned = sanitizeFilenamePart(value, Math.max(maxLength * 2, 64));
  if (cleaned.length <= maxLength) return cleaned;

  const lastHyphen = cleaned.lastIndexOf("-");
  if (lastHyphen > 0) {
    const tail = cleaned.slice(lastHyphen + 1);
    if (tail.length >= 4 && tail.length <= maxLength) {
      return tail;
    }
  }

  return (
    cleaned.slice(-maxLength).replace(/^[-_.]+/, "") ||
    cleaned.slice(0, maxLength).replace(/[-_.]+$/g, "") ||
    "No-Invoice"
  );
}

function calendarDateStamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Billing document basename:
 * `{Prefix}_{ClientShortCode|Supplier}_{InvoiceNumber}` — optional `_{YYYY-MM-DD}` when date is set.
 * Tax invoices and purchase invoices omit the date.
 * Purchase / purchase-tax invoices pass supplier as `clientName` (no shortCode).
 */
export function buildBillingDocumentFileBase(input: {
  prefix:
    | "Tax-Invoice"
    | "Proof-of-Payment"
    | "Purchase-Invoice"
    | "Purchase-Tax-Invoice";
  /** Prefer shortCode (e.g. C001). Falls back to clientName only if code missing. */
  clientShortCode?: string | null;
  clientName?: string | null;
  invoiceNumber?: string | null;
  /** When set, appends `_{YYYY-MM-DD}` (UTC). Omit for tax / purchase invoices. */
  date?: Date | null;
}): string {
  const rawCode = input.clientShortCode?.trim();
  const client = sanitizeFilenamePart(
    rawCode || input.clientName || "Unknown",
    rawCode ? CLIENT_CODE_MAX : 32
  );
  const invoice = shortenInvoiceRefPart(
    input.invoiceNumber ?? "No-Invoice",
    INVOICE_REF_MAX
  );
  const parts = [input.prefix, client, invoice];
  if (input.date) {
    parts.push(calendarDateStamp(input.date));
  }
  const base = parts.join("_");
  if (base.length <= BASENAME_MAX) return base;
  return base.slice(0, BASENAME_MAX).replace(/[-_.]+$/g, "") || input.prefix;
}

async function pathExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveUniqueFilename(
  uploadDir: string,
  baseName: string,
  ext: string
): Promise<string> {
  const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
  const safeBase = sanitizeFilenamePart(baseName, BASENAME_MAX);
  const primary = `${safeBase}${safeExt}`;
  if (!(await pathExists(path.join(uploadDir, primary)))) {
    return primary;
  }
  const shortId = randomUUID().slice(0, 8);
  return `${safeBase}_${shortId}${safeExt}`;
}

export async function saveUpload(
  file: File,
  folder = "uploads",
  options?: SaveUploadOptions
) {
  // Only allow nested public/ folders (no path traversal).
  const safeFolder = folder
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  if (!safeFolder) {
    throw new Error("Invalid upload folder.");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = path.extname(file.name) || ".jpg";
  const uploadDir = path.join(process.cwd(), "public", ...safeFolder.split("/"));
  await mkdir(uploadDir, { recursive: true });

  const filename = options?.fileBaseName
    ? await resolveUniqueFilename(uploadDir, options.fileBaseName, ext)
    : `${randomUUID()}${ext}`;

  const filepath = path.join(uploadDir, filename);
  await writeFile(filepath, buffer);

  return `/${safeFolder}/${filename}`;
}

/**
 * Best-effort delete for files stored under public/uploads/...
 * Ignores missing files and non-local paths.
 */
export async function deleteLocalUpload(publicPath: string | null | undefined) {
  if (!publicPath) return;

  const cleaned = publicPath.split("?")[0].trim();
  if (!cleaned.startsWith("/uploads/")) return;

  const relative = cleaned.replace(/^\/+/, "").replace(/\//g, path.sep);
  const publicRoot = path.resolve(process.cwd(), "public");
  const full = path.resolve(publicRoot, relative);

  // Prevent path traversal outside public/
  if (!full.startsWith(publicRoot + path.sep) && full !== publicRoot) return;

  try {
    await unlink(full);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    // Non-fatal: DB row is already gone; leave orphan files if unlink fails.
  }
}
