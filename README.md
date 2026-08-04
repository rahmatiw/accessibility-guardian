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

## Status: skeleton (2026-08-04)

This is a first pass proving the **shape** of the tool — folder structure, types, CLI commands wired
end-to-end — deliberately *not* the real scanner yet. What that means concretely:

| Piece | Status |
|---|---|
| CLI (`accessibility-guardian scan` / `baseline`) | Wired, dispatches to command modules |
| Config loading (`accessibility.config.js`) | Implemented |
| Baseline types + loader | Implemented, and **already matches real data** — see below |
| Route discovery | One built-in strategy (reads routes straight from the baseline) |
| Diff engine (New/Existing/Fixed/Reopened/Waived) | Implemented at the page+criteria level; element-level matching (via CSS selector) is a TODO |
| Report generator (Markdown + JSON) | Implemented |
| Playwright + axe-core scanner | **Not implemented.** `runScan()` throws on purpose so `scan` fails loudly instead of silently reporting a false "all clear" |
| Baseline re-learn command | **Not implemented** |
| Knowledge base (fix-pattern learning, doc §8.2) | Types only, no storage yet — open question in the doc (§12.8) about per-repo vs. shared storage isn't resolved |

`playwright` and `@axe-core/playwright` are intentionally not yet added as dependencies — they're the
next real piece of work, not needed to prove this skeleton compiles and runs.

## Why the baseline types aren't hypothetical

`src/baseline/types.ts` and `loadBaseline.ts` are written directly against the real baseline already
bootstrapped for frontend-client (`accessibility/baseline/` in that repo, 56 pages / 4,553 findings
classified pass / not_applicable / closed_verified / waived / open — see that repo's
`accessibility/baseline/README.md`). Loading that baseline with this code is provable today even though
scanning isn't built yet.

## Using this in a repo (once the scanner is built)

1. `npm install accessibility-guardian` (or a git dependency, pending §12.5 in the requirements doc).
2. Copy `accessibility.config.example.js` to `accessibility.config.js` at your repo root and fill in
   `baseURL`, `auth`, `baselineDir`, `reportDir`.
3. Make sure `accessibility/baseline/` exists in your repo (frontend-client's is already bootstrapped;
   other repos get theirs once audited).
4. `npx accessibility-guardian scan`

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
