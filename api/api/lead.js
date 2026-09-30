import { handleCors, readJson, clean, EMAIL_RE, escapeHtml, wrapHtml } from "../lib/http.js";
import { sendEmail, teamRecipients } from "../lib/email.js";

// One entry per site form. `fields` are [payload key, label, required].
const FORMS = {
  index: {
    heading: "RETENTION DIAGNOSTIC REQUEST",
    subject: (d) => `Retention Diagnostic Request — ${d.company}`,
    fields: [
      ["name", "Name", true],
      ["company", "Company", true],
      ["email", "Work email", true],
      ["phone", "Phone"],
      ["employee-count", "Approximate employees", true],
      ["turnover-concern", "Primary concern", true],
      ["affected-roles", "Roles/departments affected"],
      ["contact-method", "Preferred contact method"],
      ["contact-time", "Best contact time"],
      ["situation", "What we are seeing", true, 5000],
    ],
  },
  benefits: {
    heading: "EMPLOYER BENEFITS REVIEW REQUEST",
    subject: (d) => `Employer Benefits Review — ${d.company}`,
    fields: [
      ["name", "Name", true],
      ["company", "Company", true],
      ["email", "Work email", true],
      ["phone", "Phone"],
      ["method", "Preferred contact"],
      ["time", "Best time"],
      ["note", "Additional context", false, 5000],
    ],
    profile: "DIAGNOSTIC PROFILE",
  },
  results: {
    heading: "DIAGNOSTIC RESULTS REQUEST",
    subject: (d) => `Diagnostic Results — ${d.company}`,
    fields: [
      ["name", "Name", true],
      ["company", "Company", true],
      ["email", "Work email", true],
      ["phone", "Phone"],
      ["method", "Preferred contact"],
      ["time", "Best time"],
      ["notes", "Additional context", false, 5000],
    ],
    results: true,
    visitorCopy: true,
  },
};

const DISCLAIMER =
  "The diagnostic content is educational and does not replace legal, tax, " +
  "insurance, investment, actuarial, or fiduciary advice.";

function cleanList(list, maxItems = 12) {
  return Array.isArray(list)
    ? list.slice(0, maxItems).map((x) => clean(x, 1000)).filter(Boolean)
    : [];
}

function cleanProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return [];
  return Object.entries(profile)
    .slice(0, 20)
    .map(([k, v]) => [clean(k, 100), clean(v, 500)])
    .filter(([k, v]) => k && v);
}

function cleanResults(results) {
  if (!Array.isArray(results)) return [];
  return results.slice(0, 3).map((r) => ({
    type: clean(r?.type, 200),
    title: clean(r?.title, 300),
    summary: clean(r?.summary, 3000),
    why: cleanList(r?.why),
    verify: cleanList(r?.verify),
    alternative: clean(r?.alternative, 2000),
    profile: cleanProfile(r?.profile),
  }));
}

function resultText(r) {
  return [
    r.type.toUpperCase(),
    r.title,
    r.summary,
    r.why.length ? "Why this direction: " + r.why.join("; ") : "",
    r.verify.length ? "Verify: " + r.verify.join("; ") : "",
    r.alternative ? "Also compare: " + r.alternative : "",
    r.profile.length
      ? "Profile: " + r.profile.map(([k, v]) => `${k}: ${v}`).join("; ")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function resultHtml(r) {
  const list = (items) =>
    "<ul>" + items.map((x) => `<li>${escapeHtml(x)}</li>`).join("") + "</ul>";
  return (
    `<div style="border-left:5px solid #6f4b8b;background:#f5f3ec;padding:14px 18px;margin:0 0 18px">` +
    `<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6f4b8b;font-weight:700">${escapeHtml(r.type)}</div>` +
    `<h2 style="margin:6px 0 8px;font-size:19px;color:#17213f">${escapeHtml(r.title)}</h2>` +
    `<p style="margin:0 0 10px">${escapeHtml(r.summary)}</p>` +
    (r.why.length ? `<strong>Why this direction</strong>${list(r.why)}` : "") +
    (r.verify.length ? `<strong>What to verify</strong>${list(r.verify)}` : "") +
    (r.alternative
      ? `<strong>Also compare</strong><p style="margin:4px 0 0">${escapeHtml(r.alternative)}</p>`
      : "") +
    `</div>`
  );
}

function rowsHtml(rows) {
  return (
    `<table cellpadding="6" style="border-collapse:collapse;font-size:14px">` +
    rows
      .map(
        ([label, value]) =>
          `<tr><td style="color:#626b78;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>` +
          `<td style="white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
      )
      .join("") +
    `</table>`
  );
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  const body = readJson(req);
  if (!body) return res.status(400).json({ ok: false, error: "invalid_json" });

  // Honeypot: a hidden field real visitors never fill in. Pretend success so
  // bots get no signal, but send nothing.
  if (clean(body.website)) return res.status(200).json({ ok: true });

  const form = FORMS[body.form];
  if (!form) return res.status(400).json({ ok: false, error: "unknown_form" });

  const data = {};
  const missing = [];
  for (const [key, , required, max] of form.fields) {
    data[key] = clean(body[key], max ?? 500);
    if (required && !data[key]) missing.push(key);
  }
  if (missing.length)
    return res.status(400).json({ ok: false, error: "missing_fields", fields: missing });
  if (!EMAIL_RE.test(data.email))
    return res.status(400).json({ ok: false, error: "invalid_email" });

  const profile = form.profile ? cleanProfile(body.profile) : [];
  const results = form.results ? cleanResults(body.results) : [];
  if (form.results && !results.length)
    return res.status(400).json({ ok: false, error: "missing_results" });

  // --- Notification to the team inbox ---
  const rows = form.fields.map(([key, label]) => [label, data[key] || "Not provided"]);
  const text = [
    form.heading,
    "",
    ...rows.map(([l, v]) => `${l}: ${v}`),
    ...(profile.length
      ? ["", form.profile, ...profile.map(([k, v]) => `${k}: ${v}`)]
      : []),
    ...(results.length ? ["", "RESULTS", results.map(resultText).join("\n\n")] : []),
  ].join("\n");
  const html = wrapHtml(
    `<h1 style="font-size:18px;color:#17213f">${escapeHtml(form.heading)}</h1>` +
      rowsHtml(rows) +
      (profile.length
        ? `<h2 style="font-size:16px;color:#17213f;margin-top:22px">${escapeHtml(form.profile)}</h2>` +
          rowsHtml(profile)
        : "") +
      (results.length
        ? `<h2 style="font-size:16px;color:#17213f;margin-top:22px">Results</h2>` +
          results.map(resultHtml).join("")
        : ""),
  );

  try {
    await sendEmail({
      to: teamRecipients(),
      subject: form.subject(data),
      text,
      html,
      replyTo: data.email,
    });
  } catch (err) {
    console.error("Team notification failed:", err);
    return res.status(502).json({ ok: false, error: "send_failed" });
  }

  // --- Copy of the results to the visitor (results page only) ---
  let visitorCopySent = false;
  if (form.visitorCopy) {
    const firstName = data.name.split(/\s+/)[0];
    try {
      await sendEmail({
        to: data.email,
        subject: "Your Stop Losing Talent result summary",
        text: [
          `Hi ${firstName},`,
          "",
          "Thank you for completing the Stop Losing Talent diagnostic. Your result summary is below.",
          "",
          results.map(resultText).join("\n\n"),
          "",
          "A member of our team may contact you to clarify your answers or discuss next steps. You are not obligated to purchase any product or service.",
          "",
          DISCLAIMER,
          "",
          "Stop Losing Talent",
          "https://stoplosingtalent.com",
        ].join("\n"),
        html: wrapHtml(
          `<p>Hi ${escapeHtml(firstName)},</p>` +
            `<p>Thank you for completing the Stop Losing Talent diagnostic. Your result summary is below.</p>` +
            results.map(resultHtml).join("") +
            `<p>A member of our team may contact you to clarify your answers or discuss next steps. You are not obligated to purchase any product or service.</p>` +
            `<p style="font-size:12px;color:#626b78">${escapeHtml(DISCLAIMER)}</p>` +
            `<p><strong>Stop Losing Talent</strong><br><a href="https://stoplosingtalent.com" style="color:#6f4b8b">stoplosingtalent.com</a></p>`,
        ),
      });
      visitorCopySent = true;
    } catch (err) {
      // The lead itself was delivered; don't fail the whole request.
      console.error("Visitor copy failed:", err);
    }
  }

  return res.status(200).json({ ok: true, visitorCopySent });
}
