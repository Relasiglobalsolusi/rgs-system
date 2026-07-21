/**
 * Shared SMTP helper for transactional email (password reset, etc.).
 * Uses the same SMTP_* env vars as invoice delivery.
 */

type NodemailerModule = {
  createTransport: (opts: Record<string, unknown>) => {
    sendMail: (opts: Record<string, unknown>) => Promise<unknown>;
  };
};

export type SendMailResult =
  | { sent: true; reason: "sent" }
  | {
      sent: false;
      reason: "smtp_not_configured" | "nodemailer_missing" | "send_failed";
    };

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendMailResult> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.info(
      `[mail:STUB] Would email ${input.to}: ${input.subject}\n${input.text}`
    );
    return { sent: false, reason: "smtp_not_configured" };
  }

  try {
    const nodemailerModuleId = "nodemailer";
    const nodemailer = (await import(
      /* webpackIgnore: true */ nodemailerModuleId
    ).catch(() => null)) as NodemailerModule | null;

    if (!nodemailer) {
      console.info(
        `[mail:STUB] SMTP_HOST set but nodemailer is not installed. Would email ${input.to}.`
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
      from:
        process.env.SMTP_FROM ||
        process.env.SMTP_USER ||
        "noreply@rgs.co.id",
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return { sent: true, reason: "sent" };
  } catch (error) {
    console.error("[mail] Failed to send:", error);
    return { sent: false, reason: "send_failed" };
  }
}

export function appPublicBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}
