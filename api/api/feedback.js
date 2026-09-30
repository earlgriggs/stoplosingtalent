import { handleCors, readJson, clean } from "../lib/http.js";
import { rpc } from "../lib/db.js";
import { QUESTIONS, sendPendingDigests } from "../lib/digest.js";

const LIKERT = {
  "strongly agree": 5,
  agree: 4,
  neutral: 3,
  disagree: 2,
  "strongly disagree": 1,
};

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  const body = readJson(req);
  if (!body) return res.status(400).json({ ok: false, error: "invalid_json" });

  const token = clean(body.token, 200);
  const campaign = clean(body.campaign, 200);
  if (!token || !campaign)
    return res.status(400).json({ ok: false, error: "missing_token" });

  const args = { p_token: token, p_campaign_id: campaign };
  for (const [key] of QUESTIONS) {
    const score = LIKERT[clean(body[key], 40).toLowerCase()];
    if (!score)
      return res.status(400).json({ ok: false, error: "missing_answer", field: key });
    args[`p_${key}`] = score;
  }
  args.p_one_change = clean(body.one_change, 1000);

  let digestId = null;
  try {
    const rows = await rpc("submit_feedback", args);
    digestId = rows?.[0]?.digest_id ?? null;
  } catch (err) {
    if (err.details?.message === "invalid_or_used_token")
      return res.status(403).json({ ok: false, error: "invalid_or_used_token" });
    console.error("submit_feedback failed:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }

  // The response is saved. If it completed a batch, email the digest now; if
  // that fails it stays pending and is retried from the admin page.
  if (digestId) {
    try {
      await sendPendingDigests(digestId);
    } catch (err) {
      console.error("Digest send failed:", err);
    }
  }

  return res.status(200).json({ ok: true });
}
