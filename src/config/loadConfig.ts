import fs from "fs";
import path from "path";
import { GuardianConfig } from "./types";

/**
 * Loads a consuming repo's accessibility.config.js from its working directory.
 * See accessibility.config.example.js at the repo root for the expected shape.
 */
export function loadConfig(cwd: string = process.cwd()): GuardianConfig {
  const configPath = path.join(cwd, "accessibility.config.js");
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `No accessibility.config.js found in ${cwd}. See accessibility.config.example.js for the expected shape.`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const config = require(configPath) as GuardianConfig;
  return config;
}
