// All outbound email goes through Resend — the single email provider for
// both lead notifications and feedback digests.

export const FROM = "Stop Losing Talent <info@stoplosingtalent.com>";
export const TEAM_INBOX = "info@stoplosingtalent.com";

// Team notifications go to info@ plus any backup addresses in the
// TEAM_COPY_TO environment variable (comma-separated), so a lead or digest
// isn't lost if mail forwarding from info@ drops it.
export function teamRecipients() {
  const extra = (process.env.TEAM_COPY_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [TEAM_INBOX, ...extra];
}

export async function sendEmail({ to, subject, text, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend error ${response.status}: ${detail}`);
  }
  return response.json();
}
