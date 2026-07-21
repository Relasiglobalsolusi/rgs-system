import path from "path";
import { saveUpload } from "@/lib/upload";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function validateWebsiteImage(file: File) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Invalid file type. Allowed: JPG, PNG, WebP, GIF.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large. Maximum size is 5 MB.");
  }

  const ext = path.extname(file.name).toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error("Invalid file extension. Allowed: JPG, PNG, WebP, GIF.");
  }
}

function resolveSafeExtension(file: File): string {
  const fromMime = MIME_TO_EXT[file.type];
  if (fromMime) {
    return fromMime;
  }

  const fromName = path.extname(file.name).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(fromName)) {
    return fromName === ".jpeg" ? ".jpg" : fromName;
  }

  return ".jpg";
}

export async function saveWebsiteImageUpload(file: File) {
  validateWebsiteImage(file);

  const ext = resolveSafeExtension(file);
  const sanitized = new File([file], `upload${ext}`, { type: file.type });

  return saveUpload(sanitized, "uploads/website");
}
