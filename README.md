# accessibility-guardian
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin git@github.com:rahmatiw/accessibility-guardian.git
git push -u origin main

Shared accessibility regression-detection CLI for Investwell's frontend repos. Scans every page of a
running app, diffs the results against that repo's certified accessibility baseline, and reports only
what's New / Existing / Reopened / Waived / Fixed — instead of re-running a full manual audit every time.

Full design rationale: `docs/accessibility-guardian-requirements.md` in the frontend-client repo.

## Status: real scanner, unverified auth (2026-08-04)

| Piece | Status |
|---|---|
| CLI (`accessibility-guardian scan` / `baseline`) | Wired, dispatches to command modules |
| Config loading (`accessibility.config.js`) | Implemented |
| Baseline types + loader | Implemented, matches real frontend-client data (see below) |
| Route discovery | One built-in strategy (reads routes straight from the baseline) |
| Playwright + axe-core scanner | **Implemented and verified** — see "Verified, but not against the real app" below |
| WCAG mapping (axe rule tags → SC codes) | Implemented (`src/scanner/wcagMapping.ts`), built from the same 55-criterion list as the baseline |
| Diff engine (New/Existing/Fixed/Reopened/Waived) | Implemented and verified live (existing/reopened/fixed all reproduced against a real axe-core scan — element-level matching via CSS selector, beyond page+criteria, is still a TODO) |
| Report generator (Markdown + JSON) | Implemented and verified |
| Login (`src/scanner/login.ts`) | **Partially verified against the real app.** Credentials selectors captured from real DOM (see below); a real run then revealed a second mobile-number + OTP step the original single-step design didn't account for — added, but the OTP screen's own selectors are auto-detected/best-effort (see below), not yet confirmed against real DOM the way the credentials and mobile-number steps were. |
| Baseline re-learn command | **Not implemented** |
| Knowledge base (fix-pattern learning, doc §8.2) | Types only, no storage yet — open question in the doc (§12.8) about per-repo vs. shared storage isn't resolved |

## Verified against a fixture (diff/report pipeline) and a real app (login mechanics)

`demo.investwell.app` returned HTTP 403 to this environment (likely WAF/bot protection, or it's only
reachable from a specific network) and is production regardless — never an automated scan target. The
diff/report pipeline was proven against a local fixture instead:

- A tiny local static server serving two hand-written HTML pages, one with real accessibility violations
  (missing `alt`, low-contrast text) and one clean.
- A hand-written fixture baseline with one `open` finding that the scan re-detects (→ classified
  `existing`), one `closed_verified` finding that the scan re-detects (→ classified `reopened`), and one
  `open` finding the scan does *not* detect (→ classified `fixed`).
- Running the real `accessibility-guardian scan` CLI against this fixture produced exactly the expected
  classifications in both `report.md` and `report.json`, using the real Playwright + axe-core scan path,
  not a mock.

Separately, login mechanics were verified against `spvithlani.investwellfront.com` (reachable, non-prod)
across several real, iterative runs:

1. First attempt: `page.goto()` timed out at 30s. Root cause: it defaults to `waitUntil: "load"`, which
   waits for every resource including third-party scripts (Google Sign-In, an embedded widget) that took
   longer than 30s on the user's network. Fixed with `gotoAndSettle()` — `domcontentloaded` only, plus a
   best-effort bounded `networkidle` wait.
2. Second attempt: login "succeeded" (no thrown error) but never reached `/client/`. The user confirmed
   the same credentials worked via manual login, so credentials weren't the issue. Added automatic
   screenshot/HTML/visible-text capture on failure rather than guessing further — this immediately showed
   the real cause: a second **mobile-number + OTP step** the original design didn't know existed.
3. Added that step with real selectors captured from the failure screenshot/HTML dump (`input[name="mobile"]`,
   `input[type="submit"][value="Send OTP"]`). The OTP screen itself is still unconfirmed — its selectors are
   auto-detected (single field or 4-8 digit boxes) with the same evidence-capture-on-failure fallback if the
   guess is wrong, per the user (this is a dev env where any OTP value is accepted, so correctness here is
   about *finding* the input, not the value).

**What this proves:** the scan → WCAG-mapping → diff → report pipeline is genuinely correct.
**What it doesn't prove:** that login against the real app works, or that axe-core's findings against the
real frontend-client pages will cleanly match the certified baseline's `criteriaCode` values in practice —
both need a real run from an environment that can reach the app, with real login selectors filled in.

## Why the baseline types aren't hypothetical

`src/baseline/types.ts` and `loadBaseline.ts` are written directly against the real baseline already
bootstrapped for frontend-client (`accessibility/baseline/` in that repo, 56 pages / 4,553 findings
classified pass / not_applicable / closed_verified / waived / open — see that repo's
`accessibility/baseline/README.md`). Loading that baseline and deriving its routes both run correctly
against the real data today.

## Using this in a repo

For frontend-client specifically, [`docs/how-to-run-a-scan.md`](docs/how-to-run-a-scan.md) is the
concrete, step-by-step team guide (setup, running a scan, reading results, testing a PR, known
limitations) — share that with the team rather than this section, which is the general/other-repos
version.

1. `npm install accessibility-guardian` (or a git dependency, pending §12.5 in the requirements doc).
2. Copy `accessibility.config.example.js` to `accessibility.config.js` at your repo root and fill in
   `baseURL`, `baselineDir`, `reportDir`, and **real** `auth` selectors (the example's are placeholders —
   see the Login row above).
3. Make sure `accessibility/baseline/` exists in your repo (frontend-client's is already bootstrapped;
   other repos get theirs once audited).
4. `npx playwright install chromium` (one-time, downloads the browser binary).
5. `npx accessibility-guardian scan`

## Running as a different user / environment

Credentials and anything account-specific should come from env vars, never be hardcoded in
`accessibility.config.js` — that file is checked into the repo. frontend-client's config reads:

| Env var | Required? | Meaning |
|---|---|---|
| `A11Y_TEST_USER` | yes | Login email |
| `A11Y_TEST_PASSWORD` | yes | Login password |
| `A11Y_TEST_MOBILE` | yes | Real registered mobile number for the OTP step (a wrong/random one is rejected — see login.ts) |
| `A11Y_ENVIRONMENT` | no | Defaults to `spvithlani`. Set this to point at a different broker subdomain. |
| `A11Y_BASE_URL` | no | Defaults to `http://<A11Y_ENVIRONMENT>.investwellfront.com`. Set directly if the URL pattern differs. |
| `A11Y_TEST_CLIENT` | no | Defaults to `"A B MANDHARA"`. Which seeded test client to view via the broker->client handoff (see clientImpersonation.ts) — any client in that account's list should work. |

This only covers swapping to a *different broker account* using the same broker->client
handoff flow. A genuine client-role account (one that logs in straight to `/client/...`,
no broker dashboard involved) needs two config changes, not just an env var: set
`postLoginUrlIncludes: "/client/"` and remove `clientSearchText` entirely.

## Development

```
npm install
npm run build   # tsc -p tsconfig.json
npm run dev      # ts-node src/cli/index.ts <scan|baseline>
```

## Known open questions (not yet decided — see requirements doc §12)

- Where this repo is actually hosted and how consuming repos pull it in (npm registry vs. git dependency
  vs. Jenkins shared library).
- Whether the knowledge base (§8.2) is shared across all 4 frontends or kept per-repo.
- Whether route discovery eventually gets framework-aware strategies (e.g. walking React Router's route
  tree) per app, beyond the current baseline-driven static list.
