# How to run an accessibility scan (frontend-client)

This is the practical, step-by-step process for running `accessibility-guardian` against
frontend-client. For the *why* behind the design, see
[`docs/accessibility-guardian-requirements.md`](../../frontend-client/docs/accessibility-guardian-requirements.md)
in frontend-client and this repo's own [README](../README.md).

## Quick start (once prerequisites below are met)

```bash
cd code/
git clone https://github.com/rahmatiw/accessibility-guardian.git
cd accessibility-guardian
npm install && npm run build
npx playwright install chromium

cd ../frontend-client
A11Y_TEST_USER=<broker-email> \
A11Y_TEST_PASSWORD=<broker-password> \
A11Y_TEST_MOBILE=<broker-account's-registered-mobile-number> \
A11Y_ENVIRONMENT=<subdomain, e.g. spvithlani> \
A11Y_TEST_CLIENT="<a client name from that broker's client list>" \
node ../accessibility-guardian/dist/cli/index.js scan

cat accessibility/reports/report.md
```

## What this actually does

It's a real browser automation: launches Chromium, logs into a real broker account, views a
specific client's dashboard (the same way a broker would), then visits every page frontend-client's
certified accessibility baseline covers, runs axe-core on each, and diffs the results against that
baseline. It is **not** a static code scanner — it only sees what's actually rendered by a running
app, so the app has to be running and reachable first.

## 1. Prerequisites

- Your normal local dev setup for frontend-client already running and reachable — i.e. whatever you
  already use to view `*.investwellfront.com` locally while developing (the local backend + a
  webpack dev build of frontend-client + the hosts-file/nginx mapping that makes e.g.
  `spvithlani.investwellfront.com` resolve to your machine). If you can already open that URL in a
  normal browser and see the app, you're set — nothing extra to install for this part.
- Node.js (v18+).
- Both repos checked out **as sibling directories** (this matters — the config currently reaches into
  accessibility-guardian via a relative path, since it isn't published anywhere yet — see §12.5 in
  the requirements doc for the still-open question of whether that should become a proper npm/git
  dependency instead):
  ```
  code/
    frontend-client/                (existing team repo)
    accessibility-guardian/         (clone from below)
  ```
  ```bash
  cd code/
  git clone https://github.com/rahmatiw/accessibility-guardian.git
  ```
  This currently lives under a personal GitHub account, not the `investwellonline` org — a deliberate
  "leave it for now" call while the tool is still being proven out, not an oversight. Ask
  [@rahmatiw](https://github.com/rahmatiw) for access if you can't reach it.
- A test broker account for whichever environment you're scanning — email/password, its registered
  mobile number (for the OTP step), and the name of a client to view under that broker. Ask your team
  lead if you don't have one; don't reuse someone else's personal login for automated runs if you can
  avoid it, since repeated automated logins can be hard on a shared account (see "Known limitations"
  below).

## 2. One-time setup

```bash
cd accessibility-guardian
npm install
npm run build
npx playwright install chromium
```

Re-run `npm run build` any time this repo's source changes (e.g. after pulling updates).

## 3. Confirm frontend-client is ready

`frontend-client` needs `accessibility.config.js` and `accessibility/baseline/` present at its root.
Both are already committed on the `feature/accessibility-guardian-baseline` branch (merging into
UAT/master soon, at which point every branch will have them automatically — check whether that's
happened yet and use the right branch/base accordingly).

## 4. Run the scan

From **inside frontend-client**, checked out to whatever you actually want to scan (see "Testing a
specific PR" below):

```bash
cd frontend-client
A11Y_TEST_USER=<broker-email> \
A11Y_TEST_PASSWORD=<broker-password> \
A11Y_TEST_MOBILE=<broker-account's-registered-mobile-number> \
A11Y_ENVIRONMENT=<subdomain, e.g. spvithlani> \
A11Y_TEST_CLIENT="<a client name from that broker's client list>" \
node ../accessibility-guardian/dist/cli/index.js scan
```

All five env vars are required — there's deliberately no default/fallback account baked into the
config, so you always have to supply your own. It'll fail immediately with a clear message listing
what's missing if you forget one.

This takes a few minutes (real navigation + a real accessibility scan per page, ~48 pages). You'll see
per-page progress in the terminal.

## 5. Read the results

```bash
frontend-client/accessibility/reports/report.md    # human-readable
frontend-client/accessibility/reports/report.json  # structured, for tooling
```

`report.md` is grouped by page. Each issue shows:
- **Status** — 🔴 NEW / 🟠 REOPENED / 🟡 EXISTING / ⚪ WAIVED / 🟢 FIXED (summary counts only)
- **Error Description** — what's wrong, plus the actual failing HTML snippet
- **Recommendation for Fix** — the concrete technical fix guidance
- **Where to find it** — a CSS selector to search for in browser DevTools
- **Possible source** (when found) — a best-effort guess at the component/file — always double-check
  this before trusting it; it's a heuristic, not guaranteed correct

**A finding with no WCAG criterion listed** ("no specific WCAG criterion — an axe best-practice
check") means axe found something outside the 55 criteria the certified audit itself covers. Still
worth looking at, but it can never show as formally "Fixed" the way baseline-tracked findings can —
the only signal is that it stops appearing in a later report.

## 6. Testing a specific PR/branch

Since this scans whatever's actually running, not source code directly:

```bash
cd frontend-client
git checkout <pr-branch>
# wait for your local webpack dev build to finish rebuilding — it watches this checkout
#   and rebuilds automatically, no restart needed
# then run the scan (step 4) against it
```

## 7. Known limitations — read before assuming something's a real bug

- **8 pages are permanently excluded** (KYC self-registration wizard steps — see
  `excludedRoutes` in `accessibility.config.js` for exact reasons; mostly because they're keyed to a
  stale application ID our test account doesn't have, or because signup's reCAPTCHA is broken for
  this domain regardless of automation).
- **The session can still drop mid-scan.** The tool auto-detects this and re-logs in (up to 3 times
  per run) rather than silently reporting wrong results — you may see `Session lost,
  re-authenticating...` in the output. If it happens on nearly every page even after that, the
  account/environment itself may need a rest rather than something being wrong with your run.
- **Component/file guesses are best-effort.** They come from grepping component names found in the
  live page against your local source tree — verify before trusting, especially if it flags a file
  that clearly isn't a UI component (e.g. a Redux reducer).
- **A source edit only shows up in the next scan if it's actually being served** — i.e. your local
  dev build has rebuilt with it. Editing a file and immediately re-scanning without waiting for the
  rebuild will show the old result.
- **`accessibility-guardian baseline`** (the command to re-learn a baseline after a real audit
  update) isn't built yet — the baseline currently only changes via manual review, per design.
