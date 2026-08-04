/**
 * `accessibility-guardian baseline` — re-learns a repo's baseline from its current
 * app state. Deliberately separate from `scan` and never invoked automatically by it
 * (doc §8.3, "Baseline changes stay PR-reviewed"): a human runs this on purpose, and
 * the resulting accessibility/baseline/ diff goes through normal PR review like any
 * other code change.
 *
 * TODO: not yet implemented. For frontend-client specifically, the Week 1 baseline
 * was bootstrapped manually from the certified audit sheet rather than by running
 * this command (see accessibility/baseline/README.md in that repo) — this command
 * is for re-bootstrapping later, e.g. after a fresh audit round.
 */
export async function baselineCommand(_cwd: string = process.cwd()): Promise<number> {
  throw new Error(
    "baselineCommand() is not yet implemented — this is a skeleton build. See README.md."
  );
}
