import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readJson, clean } from "../lib/http.js";
import { rpc, select, insert } from "../lib/db.js";
import { sendPendingDigests } from "../lib/digest.js";

const FEEDBACK_PAGE = "https://stoplosingtalent.com/feedback.html";
const MAX_LINKS = 500;

function passwordOk(given) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !given) return false;
  const a = createHash("sha256").update(String(given)).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// Readable campaign code employees can type if needed, e.g. "acme-co-7K3Q".
function newCampaignCode(company) {
  const slug = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "campaign";
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const suffix = [...randomBytes(4)].map((b) => alphabet[b % alphabet.length]).join("");
  return `${slug}-${suffix}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  if (!process.env.ADMIN_PASSWORD)
    return res.status(503).json({ ok: false, error: "admin_password_not_set" });
  if (!passwordOk(req.headers["x-admin-password"]))
    return res.status(401).json({ ok: false, error: "wrong_password" });

  const body = readJson(req) || {};

  try {
    if (body.action === "status") {
      const retried = await sendPendingDigests();
      const campaigns = await rpc("campaign_status");
      return res.status(200).json({ ok: true, campaigns, retried });
    }

    if (body.action === "create") {
      const count = Math.floor(Number(body.count));
      if (!(count >= 1 && count <= MAX_LINKS))
        return res.status(400).json({ ok: false, error: "bad_count", max: MAX_LINKS });

      let company = clean(body.company, 120);
      let campaign = clean(body.campaign, 60);
      if (campaign) {
        // Adding more links to an existing campaign: keep its company.
        const existing = await select(
          "invitations",
          `campaign_id=eq.${encodeURIComponent(campaign)}&select=company_id&limit=1`,
        );
        if (!existing.length)
          return res.status(404).json({ ok: false, error: "campaign_not_found" });
        company = existing[0].company_id;
      } else {
        if (!company)
          return res.status(400).json({ ok: false, error: "missing_company" });
        campaign = newCampaignCode(company);
      }

      const tokens = Array.from({ length: count }, () =>
        randomBytes(12).toString("base64url"),
      );
      await insert(
        "invitations",
        tokens.map((token) => ({ token, company_id: company, campaign_id: campaign })),
      );
      const links = tokens.map(
        (token) =>
          `${FEEDBACK_PAGE}?campaign=${encodeURIComponent(campaign)}&token=${token}`,
      );
      return res.status(200).json({ ok: true, company, campaign, links });
    }

    return res.status(400).json({ ok: false, error: "unknown_action" });
  } catch (err) {
    console.error("Admin action failed:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
