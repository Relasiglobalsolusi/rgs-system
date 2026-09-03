import { saveUpload, type SaveUploadOptions } from "@/lib/upload";
import {
  formFiles,
  parseStoredPaths,
  serializeStoredPaths,
} from "@/lib/stored-paths";

export {
  firstStoredPath,
  formFiles,
  hasFormFiles,
  parseStoredPaths,
  serializeStoredPaths,
} from "@/lib/stored-paths";

export async function saveUploadFiles(
  files: File[],
  folder: string,
  options?: SaveUploadOptions
): Promise<string[]> {
  const paths: string[] = [];
  for (const [index, file] of files.entries()) {
    const fileBaseName =
      options?.fileBaseName && files.length > 1
        ? `${options.fileBaseName}_${index + 1}`
        : options?.fileBaseName;
    paths.push(await saveUpload(file, folder, { fileBaseName }));
  }
  return paths;
}

export async function saveAndSerializeUploads(
  files: File[],
  folder: string,
  options?: SaveUploadOptions
): Promise<string | null> {
  return serializeStoredPaths(await saveUploadFiles(files, folder, options));
}

export async function saveAndAppendUploads(
  existing: string | null | undefined,
  files: File[],
  folder: string,
  options?: SaveUploadOptions
): Promise<string | null> {
  const added = await saveUploadFiles(files, folder, options);
  return serializeStoredPaths([...parseStoredPaths(existing), ...added]);
}

export function requireFormFiles(
  formData: FormData,
  name: string,
  message: string
): File[] {
  const files = formFiles(formData, name);
  if (files.length === 0) {
    throw new Error(message);
  }
  return files;
}
