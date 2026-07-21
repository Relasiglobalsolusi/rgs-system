/**
 * Invoice / notification delivery helpers.
 *
 * Email: real SMTP send when SMTP_HOST (+ optional SMTP_USER/SMTP_PASS) is set;
 * otherwise logs a clear stub for production wiring.
 * WhatsApp: stub only.
 *
 * The invoice PDF is always persisted on the billing period (`invoicePdfPath`)
 * so Completed Projects can download it later; when SMTP is configured the same
 * file is attached to the client email.
 */

import { existsSync } from "fs";
import path from "path";

export type InvoiceDeliveryPayload = {
  toEmail: string | null | undefined;
  clientName: string | null | undefined;
  projectName: string;
  periodLabel: string;
  amountLabel?: string | null;
  pdfPublicPath: string;
  contactPersonName?: string | null;
};

type NodemailerModule = {
  createTransport: (opts: Record<string, unknown>) => {
    sendMail: (opts: Record<string, unknown>) => Promise<unknown>;
  };
};

function appBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

/** Resolve a public `/uploads/...` path to a filesystem path under public/. */
function resolvePublicPdfPath(pdfPublicPath: string): string | null {
  const cleaned = pdfPublicPath.split("?")[0].trim().replace(/^\/+/, "");
  if (!cleaned.startsWith("uploads/")) return null;

  const publicRoot = path.resolve(process.cwd(), "public");
  const full = path.resolve(publicRoot, cleaned.replace(/\//g, path.sep));

  if (full !== publicRoot && !full.startsWith(publicRoot + path.sep)) {
    return null;
  }

  return existsSync(full) ? full : null;
}

/**
 * Send invoice PDF notification to the client contact email.
 * Uses nodemailer-compatible SMTP env vars when present; otherwise stubs.
 *
 * Env (optional): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
export async function sendInvoiceEmail(
  payload: InvoiceDeliveryPayload
): Promise<{ sent: boolean; reason: string }> {
  const to = payload.toEmail?.trim();
  if (!to) {
    const msg = `[invoice-email] No client email for project "${payload.projectName}" — skipped.`;
    console.info(msg);
    return { sent: false, reason: "no_recipient" };
  }

  const pdfUrl = `${appBaseUrl()}${payload.pdfPublicPath}`;
  const pdfFsPath = resolvePublicPdfPath(payload.pdfPublicPath);
  const pdfFileName =
    path.basename(payload.pdfPublicPath.split("?")[0]) || "invoice.pdf";
  const subject = `Invoice: ${payload.projectName} — ${payload.periodLabel}`;
  const amountLine = payload.amountLabel
    ? `\nAmount: ${payload.amountLabel}`
    : "";
  const greeting = payload.contactPersonName
    ? `Dear ${payload.contactPersonName},`
    : "Dear Client,";
  const attachmentNote = pdfFsPath
    ? "\nThe invoice PDF is attached to this email."
    : `\nPDF: ${pdfUrl}`;
  const body = `${greeting}

Please find your progress invoice for ${payload.projectName}.

Period: ${payload.periodLabel}${amountLine}${attachmentNote}

Status: Awaiting Payment

— Relasi Global Solusi`;

  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.info(
      `[invoice-email:STUB] SMTP not configured (set SMTP_HOST). Would email ${to} for "${payload.projectName}" (${payload.periodLabel}). PDF: ${pdfUrl}${
        pdfFsPath ? ` (attach ${pdfFileName})` : ""
      }`
    );
    console.info(`[invoice-email:STUB] Body preview:\n${body}`);
    return { sent: false, reason: "smtp_not_configured" };
  }

  try {
    // Dynamic import keeps cold paths light; nodemailer is a declared dependency.
    const nodemailerModuleId = "nodemailer";
    const nodemailer = (await import(
      /* webpackIgnore: true */ nodemailerModuleId
    ).catch(() => null)) as NodemailerModule | null;

    if (!nodemailer) {
      console.info(
        `[invoice-email:STUB] SMTP_HOST set but nodemailer failed to load. Would email ${to}. PDF: ${pdfUrl}`
      );
      return { sent: false, reason: "nodemailer_missing" };
    }

    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@rgs.local",
      to,
      subject,
      text: body,
      attachments: pdfFsPath
        ? [
            {
              filename: pdfFileName,
              path: pdfFsPath,
              contentType: "application/pdf",
            },
          ]
        : undefined,
    });

    console.info(`[invoice-email] Sent to ${to} for "${payload.projectName}".`);
    return { sent: true, reason: "sent" };
  } catch (error) {
    console.error("[invoice-email] Failed to send:", error);
    return { sent: false, reason: "send_failed" };
  }
}

/** WhatsApp delivery stub — wire Business API later. */
export async function sendInvoiceWhatsAppStub(
  payload: InvoiceDeliveryPayload & { phone?: string | null }
): Promise<void> {
  console.info(
    `[invoice-whatsapp:STUB] Would notify ${payload.phone ?? "(no phone)"} for "${payload.projectName}" / ${payload.periodLabel}.`
  );
}
