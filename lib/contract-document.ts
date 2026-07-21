import {
  CLIENT_REVIEW_PROOF_MAX_BYTES,
  CLIENT_REVIEW_PROOF_MIME,
} from "@/lib/client-billing-review";
import { saveUpload } from "@/lib/upload";

/** Signed contract / extension proof uploads. */
export const CONTRACT_DOCUMENT_FOLDER = "uploads/contract-documents";

export function requireContractProofFile(
  value: FormDataEntryValue | null,
  opts: { required: boolean; label?: string }
): File | null {
  const label = opts.label ?? "Signed contract document";
  if (!(value instanceof File) || value.size <= 0) {
    if (opts.required) {
      throw new Error(`${label} is required.`);
    }
    return null;
  }
  if (value.size > CLIENT_REVIEW_PROOF_MAX_BYTES) {
    throw new Error("File must be 10 MB or smaller.");
  }
  const mime = value.type || "";
  if (mime && !CLIENT_REVIEW_PROOF_MIME.has(mime)) {
    throw new Error("Upload an image or PDF only.");
  }
  return value;
}

export async function saveContractDocument(
  file: File,
  fileBaseName: string
): Promise<string> {
  return saveUpload(file, CONTRACT_DOCUMENT_FOLDER, { fileBaseName });
}
