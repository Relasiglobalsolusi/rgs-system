export function taxInvoiceDateToUtcDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Browser MIME is often empty or octet-stream on Windows / WhatsApp files. */
export function inferDocumentMime(file: File): string {
  const mime = (file.type || "").trim().toLowerCase();
  if (mime === "image/jpg") return "image/jpeg";
  if (mime && mime !== "application/octet-stream") return mime;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return mime || "application/octet-stream";
}
