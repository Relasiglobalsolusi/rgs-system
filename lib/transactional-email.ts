/**
 * Branded HTML for RGS ONE transactional mail.
 * Same chrome as the rgs.co.id contact-form emails: navy header, white card.
 * Header mark is the RGS ONE product logo, not the company letterhead.
 */

const SITE_URL = "https://www.rgs.co.id";
const PHONE = "+62 21 2295 2228";

/** Public HTTPS URL so inbox clients can load the mark (not localhost). */
const RGS_ONE_LOGO_URL = "https://one.rgs.co.id/rgs-one-logo.png";

export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function brandedTransactionalEmailHtml(input: {
  heading: string;
  bodyHtml: string;
  footer: string;
}): string {
  const heading = escapeEmailHtml(input.heading);
  return `
<div style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dbe3ec;">
          <tr>
            <td style="background:#07152d;padding:36px;text-align:center;">
              <img src="${RGS_ONE_LOGO_URL}" alt="RGS ONE" style="width:180px;max-width:70%;display:block;margin:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:40px 42px;color:#1e293b;font-size:16px;line-height:1.8;">
              <h2 style="margin:0 0 24px;color:#0f172a;font-size:24px;line-height:1.3;">${heading}</h2>
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;font-size:13px;color:#64748b;">
              ${escapeEmailHtml(input.footer)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`.trim();
}

export function passwordResetEmail(input: {
  username: string;
  resetUrl: string;
}): { subject: string; text: string; html: string } {
  const username = input.username.trim();
  const resetUrl = input.resetUrl.trim();
  const safeUrl = escapeEmailHtml(resetUrl);
  const safeUser = escapeEmailHtml(username);

  const bodyHtml = `
<p style="margin-top:0;">Hello,</p>
<p>
  We received a request to reset the <strong>RGS ONE</strong> password
  for username <strong>${safeUser}</strong>.
</p>
<p>
  Use the button below to choose a new password. This link expires in 1 hour.
</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0;">
  <tr>
    <td align="center">
      <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;">
        Choose a New Password
      </a>
    </td>
  </tr>
</table>
<table width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 28px;">
  <tr>
    <td style="background:#eff6ff;border-left:5px solid #2563eb;padding:18px;border-radius:8px;font-size:14px;color:#1e293b;">
      If the button does not open, paste this link into your browser:<br>
      <a href="${safeUrl}" style="color:#2563eb;word-break:break-all;">${safeUrl}</a>
    </td>
  </tr>
</table>
<p>
  If you did not ask for a new password, you can ignore this email.
  Your current password will stay the same.
</p>
<br>
<p style="margin-bottom:6px;">Kind regards,</p>
<p style="margin-top:0;line-height:1.8;">
  <strong>Relasi Global Solusi</strong><br>
  Jl. Daan Mogot KM 14.5, Ruko Point 8 Blok F6<br>
  Duri Kosambi, Cengkareng<br>
  West Jakarta 11750<br>
  ${PHONE}<br>
  <a href="${SITE_URL}" style="color:#2563eb;text-decoration:none;font-weight:600;">${SITE_URL}</a>
</p>`.trim();

  return {
    subject: "Reset Your RGS ONE Password",
    html: brandedTransactionalEmailHtml({
      heading: "Reset Your RGS ONE Password",
      bodyHtml,
      footer:
        "This message was sent because a password reset was requested on RGS ONE. It is not a daily inbox notice.",
    }),
    text: `Hello,

We received a request to reset the RGS ONE password for username ${username}.

Open this link to choose a new password (expires in 1 hour):

${resetUrl}

If you did not ask for a new password, you can ignore this email. Your current password will stay the same.

Kind regards,
Relasi Global Solusi
Jl. Daan Mogot KM 14.5, Ruko Point 8 Blok F6
Duri Kosambi, Cengkareng
West Jakarta 11750
${PHONE}
${SITE_URL}
`,
  };
}
