import { showRejection } from "@/components/ui/rejection-notice";

export async function downloadSystemGuidePdf(input: {
  url: string;
  body: unknown;
  fallbackFilename: string;
  failedMessage: string;
}): Promise<boolean> {
  const response = await fetch(input.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input.body),
  });
  if (!response.ok) {
    let message = input.failedMessage;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      /* keep default */
    }
    showRejection({ reasons: message });
    return false;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const header = response.headers.get("Content-Disposition") ?? "";
  const match = header.match(/filename="([^"]+)"/);
  link.href = url;
  link.download = match?.[1] ?? input.fallbackFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
