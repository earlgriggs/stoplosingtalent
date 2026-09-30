import { select, update } from "./db.js";
import { sendEmail, teamRecipients } from "./email.js";
import { escapeHtml, wrapHtml } from "./http.js";

// Survey questions in page order, with the category each one measures.
export const QUESTIONS = [
  ["manager_fairness", "Fairness", "My supervisor treats employees fairly."],
  ["workload", "Workload", "My workload is generally sustainable."],
  ["speak_up", "Psychological safety", "I can raise concerns without fear of retaliation."],
  ["communication", "Communication", "Leadership communicates important changes clearly."],
  ["recognition", "Recognition", "Good work is recognized consistently."],
  ["resources", "Resources", "I have the tools and resources needed to succeed."],
  ["intent_to_stay", "Retention risk", "I can see myself working here 12 months from now."],
  ["work_arrangement", "Work arrangement", "My work arrangement supports effective performance."],
];

function band(avg) {
  if (avg >= 4) return ["Strength", "#5d7a52"];
  if (avg >= 3) return ["Watch", "#a8842f"];
  return ["Concern", "#9b3d3d"];
}

export function buildDigest(digest) {
  const q = digest.payload.questions || {};
  const rows = QUESTIONS.map(([key, category, statement]) => ({
    category,
    statement,
    avg: Number(q[key]?.avg ?? 0),
    fav: Number(q[key]?.favorable_pct ?? 0),
  }));
  const composite = rows.reduce((s, r) => s + r.avg, 0) / rows.length;
  const comments = digest.payload.comments || [];
  const n = digest.response_count;
  const subject = `Employee Feedback Digest — ${digest.company_id} (${digest.campaign_id}) — ${n} responses`;

  const text = [
    "EMPLOYEE FEEDBACK DIGEST",
    "",
    `Company: ${digest.company_id}`,
    `Campaign: ${digest.campaign_id}`,
    `Responses included: ${n}`,
    `Overall score: ${composite.toFixed(2)} / 5 (${band(composite)[0]})`,
    "",
    "CATEGORY SCORES (average of 5 = Strongly agree ... 1 = Strongly disagree)",
    ...rows.map(
      (r) =>
        `${r.category}: ${r.avg.toFixed(2)} / 5, ${r.fav}% favorable (${band(r.avg)[0]}) — "${r.statement}"`,
    ),
    "",
    "Retention risk is based on intent to stay: a higher score means lower risk.",
    "",
    `COMMENTS (${comments.length}, in random order)`,
    ...(comments.length ? comments.map((c) => `- ${c}`) : ["None provided."]),
    "",
    "Responses are anonymous: answers are stored with no link to the invitation or employee.",
    "A new digest is sent each time this campaign gains 5 more responses.",
  ].join("\n");

  const cell = "padding:8px 10px;border-bottom:1px solid #e3e0d6;vertical-align:top";
  const html = wrapHtml(
    `<h1 style="font-size:20px;color:#17213f;margin:0 0 4px">Employee feedback digest</h1>` +
      `<p style="margin:0 0 16px;color:#626b78">${escapeHtml(digest.company_id)} · campaign ${escapeHtml(digest.campaign_id)} · ${n} responses</p>` +
      `<div style="background:#f5f3ec;border-left:5px solid #6f4b8b;padding:14px 18px;margin:0 0 20px">` +
      `<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6f4b8b;font-weight:700">Overall score</div>` +
      `<div style="font-size:28px;font-weight:700;color:#17213f">${composite.toFixed(2)} <span style="font-size:16px;color:#626b78">/ 5</span></div>` +
      `<div style="font-weight:700;color:${band(composite)[1]}">${band(composite)[0]}</div></div>` +
      `<table cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%">` +
      `<tr style="text-align:left;color:#626b78"><th style="${cell}">Category</th><th style="${cell}">Avg / 5</th><th style="${cell}">Favorable</th><th style="${cell}">Status</th></tr>` +
      rows
        .map(
          (r) =>
            `<tr><td style="${cell}"><strong>${escapeHtml(r.category)}</strong><br><span style="color:#626b78;font-size:12px">${escapeHtml(r.statement)}</span></td>` +
            `<td style="${cell}">${r.avg.toFixed(2)}</td><td style="${cell}">${r.fav}%</td>` +
            `<td style="${cell};color:${band(r.avg)[1]};font-weight:700">${band(r.avg)[0]}</td></tr>`,
        )
        .join("") +
      `</table>` +
      `<p style="font-size:12px;color:#626b78">Favorable = Agree or Strongly agree. Retention risk is based on intent to stay: a higher score means lower risk. Strength ≥ 4.0, Watch 3.0–3.99, Concern &lt; 3.0.</p>` +
      `<h2 style="font-size:16px;color:#17213f;margin-top:22px">Comments (${comments.length}, in random order)</h2>` +
      (comments.length
        ? `<ul>${comments.map((c) => `<li style="margin-bottom:6px">${escapeHtml(c)}</li>`).join("")}</ul>`
        : `<p>None provided.</p>`) +
      `<p style="font-size:12px;color:#626b78">Responses are anonymous: answers are stored with no link to the invitation or employee. A new digest is sent each time this campaign gains 5 more responses.</p>`,
  );
  return { subject, text, html };
}

// Sends every digest that hasn't been emailed yet (or just `id`). Failures
// stay pending and are retried the next time this runs.
export async function sendPendingDigests(id) {
  const filter = id ? `id=eq.${encodeURIComponent(id)}` : "sent_at=is.null";
  const pending = await select(
    "digests",
    `${filter}&sent_at=is.null&select=*&order=created_at.asc`,
  );
  let sent = 0;
  for (const digest of pending) {
    try {
      await sendEmail({ to: teamRecipients(), ...buildDigest(digest) });
      await update("digests", `id=eq.${digest.id}`, {
        sent_at: new Date().toISOString(),
      });
      sent++;
    } catch (err) {
      console.error(`Digest ${digest.id} failed:`, err);
    }
  }
  return { pending: pending.length, sent };
}
