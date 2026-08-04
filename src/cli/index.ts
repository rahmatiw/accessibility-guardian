#!/usr/bin/env node
import { scanCommand } from "../commands/scan";
import { baselineCommand } from "../commands/baseline";

async function main(): Promise<void> {
  const [, , subcommand] = process.argv;

  switch (subcommand) {
    case "scan": {
      const exitCode = await scanCommand();
      process.exit(exitCode);
      break;
    }
    case "baseline": {
      const exitCode = await baselineCommand();
      process.exit(exitCode);
      break;
    }
    default:
      console.error(
        `Usage: accessibility-guardian <scan|baseline>\n\nGot: ${subcommand ?? "(nothing)"}`
      );
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
