import { select } from "../lib/db.js";

// Called once a day by Vercel Cron (see vercel.json). Supabase's free plan
// pauses a project after about a week without activity, which would break
// survey links between client campaigns; one tiny query a day prevents that.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`)
    return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    await select("invitations", "select=campaign_id&limit=1");
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Keep-alive query failed:", err);
    return res.status(500).json({ ok: false, error: "db_unreachable" });
  }
}
