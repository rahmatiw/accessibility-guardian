import fs from "fs";
import path from "path";
import { BaselineIndex, PageBaseline } from "./types";

export interface LoadedBaseline {
  index: BaselineIndex;
  pages: Map<string, PageBaseline>; // keyed by slug
}

/**
 * Loads a consuming repo's accessibility/baseline/ directory (index.json + pages/*.json).
 * This is the read side only — writing/regenerating a baseline is the separate,
 * explicitly-run `accessibility-guardian baseline` command (see src/commands/baseline.ts),
 * never done implicitly by a scan.
 */
export function loadBaseline(baselineDir: string): LoadedBaseline {
  const indexPath = path.join(baselineDir, "index.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `No baseline found at ${indexPath}. Run "accessibility-guardian baseline" first, or bootstrap manually.`
    );
  }

  const index: BaselineIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const pages = new Map<string, PageBaseline>();

  for (const entry of index.pages) {
    const pagePath = path.join(baselineDir, entry.file);
    const pageDoc: PageBaseline = JSON.parse(fs.readFileSync(pagePath, "utf8"));
    pages.set(entry.slug, pageDoc);
  }

  return { index, pages };
}
