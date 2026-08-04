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
| Login (`src/scanner/login.ts`) | **Implemented but unverified against the real app.** Generic credentials-based form-fill, but the actual selectors (`usernameSelector`, `passwordSelector`, etc.) in `accessibility.config.example.js` are placeholders — this environment got a 403 trying to reach `https://demo.investwell.app` to inspect the real login form. Throws a clear error naming missing config rather than silently doing nothing. |
| Baseline re-learn command | **Not implemented** |
| Knowledge base (fix-pattern learning, doc §8.2) | Types only, no storage yet — open question in the doc (§12.8) about per-repo vs. shared storage isn't resolved |

## Verified, but not against the real app

`demo.investwell.app` returned HTTP 403 to this environment (likely WAF/bot protection, or it's only
reachable from a specific network) — so the scanner was proven against a local fixture instead of the real
frontend-client deployment:

- A tiny local static server serving two hand-written HTML pages, one with real accessibility violations
  (missing `alt`, low-contrast text) and one clean.
- A hand-written fixture baseline with one `open` finding that the scan re-detects (→ classified
  `existing`), one `closed_verified` finding that the scan re-detects (→ classified `reopened`), and one
  `open` finding the scan does *not* detect (→ classified `fixed`).
- Running the real `accessibility-guardian scan` CLI against this fixture produced exactly the expected
  classifications in both `report.md` and `report.json`, using the real Playwright + axe-core scan path,
  not a mock.

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

1. `npm install accessibility-guardian` (or a git dependency, pending §12.5 in the requirements doc).
2. Copy `accessibility.config.example.js` to `accessibility.config.js` at your repo root and fill in
   `baseURL`, `baselineDir`, `reportDir`, and **real** `auth` selectors (the example's are placeholders —
   see the Login row above).
3. Make sure `accessibility/baseline/` exists in your repo (frontend-client's is already bootstrapped;
   other repos get theirs once audited).
4. `npx playwright install chromium` (one-time, downloads the browser binary).
5. `npx accessibility-guardian scan`

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
