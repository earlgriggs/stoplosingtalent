# StopLosingTalent.com — Backend Build Brief
*Handoff from a planning conversation with Claude (chat). Give this file to Claude Code as your starting instructions.*

## Project context

StopLosingTalent.com is a live static site (currently HTML-only) offering an
employee-retention "diagnostic" — visitors answer questions and get routed to
a benefits or workplace-management recommendation, then can request a
follow-up. It also includes a confidential employee pulse survey concept
that is built as a page but **not yet wired to any backend**.

- **Repo:** `earlgriggs/stoplosingtalent` (GitHub)
- **Site files location:** the site files sit directly in the **repo
  root** — there is no subfolder. (An earlier version of this brief
  incorrectly assumed a `SLT - Purple Theme Setup` subfolder; that does
  not exist. Corrected below.)
- **Local clone path:** `C:\Users\Earl Griggs\SLT - Purple Version\stoplosingtalent`
  — this is the actual repo root on disk (GitHub Desktop nested it one
  level inside the `SLT - Purple Version` folder). Point Claude Code at
  this exact path.
- **`CLAUDE.md` location:** place at this repo root, alongside
  `index.html`, `form-config.js`, etc.
- **A config file already exists and should be used, not replaced:**
  `form-config.js`, at the repo root, currently reads:
  ```js
  window.SLT_FORM_ENDPOINT = "";
  window.SLT_TEAM_EMAIL = "info@stoplosingtalent.com";
  window.SLT_FEEDBACK_ENDPOINT = "";
  ```
  The site's pages already reference these variables for where to send
  form data — meaning the frontend likely does **not** need its submit
  handlers rewritten from scratch. The real work is: (1) build the Vercel
  backend, (2) fill in the two empty endpoint URLs once they exist, (3)
  confirm each page's existing JS actually posts to
  `SLT_FORM_ENDPOINT`/`SLT_FEEDBACK_ENDPOINT` as expected (verify this
  assumption before relying on it — check each form's current submit
  logic first). `SLT_TEAM_EMAIL` (`info@stoplosingtalent.com`) is already
  correct and should not be changed.
- **A deployment README already exists** at the repo root
  (`GITHUB_DEPLOYMENT_README.txt`) confirming this exact architecture
  independently: GitHub Pages hosts the static files as-is; a separate
  endpoint must validate the feedback token, reject reuse, store identity
  separately from answers, and return only aggregated results once a
  minimum response threshold is met. It also notes the feedback submit
  button is currently **disabled** on the live page until
  `SLT_FEEDBACK_ENDPOINT` is set — confirm this still matches actual page
  behavior when work begins.
- **Current hosting:** GitHub Pages, with GoDaddy DNS + SSL already configured
  and working for stoplosingtalent.com. **Do not disrupt this** — see
  Architecture Decision below.
- **Live pages:** `index.html`, `diagnostic.html` (hub, no form),
  `benefits.html`, `retirement.html`, `workplace.html`, `results.html`,
  `feedback.html`

## The goal

Replace the current placeholder form behavior (which just opens a
pre-filled email draft in the visitor's own email client — no real backend)
with a real backend that:

1. **Delivers lead-capture form submissions** (on `index.html`,
   `benefits.html`, and `results.html`) straight to the owner's inbox.
2. **Handles the employee feedback flow** (`feedback.html`) properly:
   validates a single-use invitation token, stores answers **with no link
   back to employee identity**, computes scores, and emails an aggregated,
   per-company digest to a separate inbox — only once enough responses
   exist to protect anonymity.

**Hard requirement from the site owner: use only one email-sending
platform** for both flows — don't mix form-service vendors (e.g. don't use
Web3Forms for one thing and something else for another).

## Tech stack (decided)

- **GitHub** — source of truth, as now.
- **Vercel** — serverless functions for the backend logic. Owner already has
  a Vercel account.
- **Supabase** — Postgres database for the two feedback tables. Owner
  already has a Supabase account.
- **One email API** (Resend suggested, not yet chosen/created) — used for
  *both* lead-form notifications and feedback digests.

### Architecture decision — DECIDED

**The site stays on GitHub Pages, full stop — owner does not want to move
it.** The current site is static, served via GitHub Pages, with GoDaddy DNS
+ SSL already working. Vercel serverless functions require a Vercel
*deployment* — they can't run on top of GitHub Pages — so the resolution is:

Leave the existing site exactly as-is on GitHub Pages. Create a *separate,
minimal* Vercel project containing only the API functions (e.g. deployed to
something like `api.stoplosingtalent.com` or a `*.vercel.app` URL), with
CORS configured to accept requests from `stoplosingtalent.com`. The
existing HTML forms just `fetch()` that endpoint. No re-platforming, no risk
to the working DNS/SSL setup.

Resulting repo structure:
```
earlgriggs/stoplosingtalent/   (repo root — also the local clone root)
├── CLAUDE.md
├── form-config.js              ← already exists, endpoints currently blank
├── GITHUB_DEPLOYMENT_README.txt
├── index.html
├── benefits.html
├── retirement.html
├── workplace.html
├── results.html
├── feedback.html
├── diagnostic.html
├── CNAME
└── api/                        ← new, separate Vercel-deployed backend
```

## What must NOT change

The owner has a finished, styled site. **Do not alter layout, CSS, or visual
design.** Given `form-config.js` already exists as the intended integration
point (see above), changes should be scoped to:
- Verifying each page's existing submit logic actually reads from
  `window.SLT_FORM_ENDPOINT` / `window.SLT_FEEDBACK_ENDPOINT` as designed —
  do not assume this without checking; if a page's JS doesn't yet reference
  these variables, wire it up to do so rather than inventing a different
  integration approach
- Filling in the two endpoint URLs in `form-config.js` once the Vercel
  backend exists
- Adding hidden fields to `feedback.html` if the token/company_id/campaign_id
  aren't already being captured and sent
- A success/error state after submission, styled to match the existing
  site (currently it shows "your email is ready, please send it" for the
  no-backend fallback — this should change to reflect real submission, but
  should look native to the page)

## Prior Claude Code session — what's already done

A previous Claude Code session started Phase 0, but was pointed at the
wrong folder (`C:\Users\Earl Griggs\OneDrive\stoplosingtalent website` —
not a git repo, disconnected from GitHub). **No website files, Vercel
projects, Supabase projects/tables, or email accounts were created or
changed** — only two CLI tools were installed, machine-wide, which still
apply regardless of folder:

- **Vercel CLI** — installed and already signed in (account
  `info-20003547`, team "earl griggs' projects", Hobby plan). No need to
  reinstall or re-login unless there's a reason to.
- **Supabase CLI** — available via `npx supabase` (no separate install
  needed), but **not yet signed in**. Run `npx supabase login` in a fresh
  terminal as an early Phase 0 step.
- **Node.js v24.16.0 and npm 11.13.0** are installed.
- **Git and the GitHub CLI are NOT installed.** GitHub Desktop was used to
  get a working clone (see below), which doesn't require the `git` CLI —
  but Claude Code will likely want direct `git` access in its own terminal
  to commit and push as part of its normal workflow. **Install Git for
  Windows before or at the very start of this session**
  (https://git-scm.com/downloads/win), then open a fresh terminal.

## Phase 0 — Setup (do this first, before writing any code)

- **Vercel:** Already installed and signed in machine-wide (see "Prior
  Claude Code session" above) — no login needed. Create the new, separate
  API-only project (per the Architecture decision above — do not touch the
  existing GitHub Pages deployment).
- **Supabase:** Owner has an account, but no project/tables exist yet, and
  the CLI isn't signed in yet. Run `npx supabase login`, then create the
  project and apply the schema from Phase 2 below via the Supabase CLI.
  **Region: US East recommended** as a default unless the owner prefers
  otherwise.
- **Email API — not yet chosen, needs the owner to act:** Resend is
  recommended (free tier, simple API), but it requires adding new DNS
  records in GoDaddy (where the domain's DNS is managed) to verify a
  sending domain — a real setup step, not just account creation. No
  account exists yet. This is the one step that needs a human to sign up
  — walk the owner through exactly what to click, get the account
  created, DNS records added, and an API key issued, before building the
  send logic in Phase 1.

## Phase 1 — Lead-capture forms

Forms to wire up:
- `index.html` — "Request a Retention Diagnostic" form
- `benefits.html` — "Prepare my review request" form
- `results.html` — shared "Email my result summary" form (fed by all three
  diagnostics: benefits, retirement, workplace)

Build: one Vercel function that accepts a POST, validates required fields,
and sends an email via the chosen email API to the owner's main inbox
(`info@stoplosingtalent.com`, per prior site setup). Straightforward, no
database needed for this phase.

## Phase 2 — Employee feedback (token + anonymity + scoring)

`feedback.html` already states its own requirement on the page: *"A secure
response service must validate a unique, single-use invitation token and
store the answers separately from identity."* Build to that spec:

**Supabase schema — two tables, deliberately not linked to each other beyond
company_id:**
- `invitations`: `token` (unique), `company_id`, `campaign_id`, `used`
  (boolean), `created_at`
- `responses`: `id`, `company_id`, `campaign_id`, per-question numeric
  scores, free-text comment, `submitted_at` — **no token, no employee
  identity, no foreign key to `invitations`**

**Flow:**
1. Submission arrives with a token → function checks `invitations` for a
   matching, unused token. If invalid/used, reject. If valid, mark it used
   (single-use enforced).
2. Answers get written to `responses`, tagged only with `company_id` /
   `campaign_id` — never with the token or any identity.
3. Scoring: map Likert answers (Strongly Agree=5 → Strongly Disagree=1),
   roll up into category scores (fairness, workload, psychological safety,
   communication, recognition, resources, retention risk, work
   arrangement), plus one overall composite score.
4. **Anonymity floor:** do NOT email a digest for a `campaign_id` until it
   has at least **3–5 responses** (threshold to be confirmed with owner).
   Below that, an "aggregate" is just one or two people's answers with
   extra steps.
5. Once the threshold is met, send the aggregated, scored digest to the
   feedback inbox (see Open Questions below for which address) — tagged by
   company_id — using the same email API as Phase 1.

## Open questions to resolve with the owner (don't guess on these)

- Which email API to actually sign up for (Resend suggested, not yet an
  account)
- How tokens get generated and distributed to employees per company (a
  manual list upload? a simple admin form the owner fills out per client?)
  — not yet decided
- Confirm the minimum-response threshold before a digest fires (suggested
  3–5)
- Feedback digest inbox: not yet decided — `info@stoplosingtalent.com` is
  confirmed as the lead-form inbox (already set correctly in
  `form-config.js`), but the feedback digest should likely go to a
  separate address (e.g. `feedback@stoplosingtalent.com`) — confirm this
  exists/should be created
- Confirm Supabase region (US East suggested as default) unless owner
  prefers another

## Note on sibling theme folders (informational, not actionable)

A separate, non-git OneDrive folder
(`C:\Users\Earl Griggs\OneDrive\stoplosingtalent website`) contains three
theme variants of this site ("SLT - Purple Theme Setup", "SLT - Charcoal
Navy Offwhite Setup", "SLT - LIVELY COLOR SETUP") plus a deployment ZIP —
this was the staging area used to pick a theme before uploading files to
GitHub. **Purple is the one live and committed to the repo** (this brief's
subject). The other two themes are not in play and don't need attention —
noted here only so their presence doesn't cause confusion if encountered.
