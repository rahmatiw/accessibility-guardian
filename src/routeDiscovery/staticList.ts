import { DiscoveredRoute, GuardianConfig, RouteDiscoveryStrategy } from "../config/types";

/**
 * Simplest possible route-discovery strategy: read the route list straight out of
 * this repo's own baseline (accessibility/baseline/index.json), which already has
 * a slug + pageUrl per audited page. This guarantees every scan revisits exactly
 * the set of pages the certified baseline covers.
 *
 * Framework-aware strategies (e.g. walking React Router's route tree) are a later,
 * per-app addition — this one has no dependency on any app's router setup.
 */
export const staticBaselineListStrategy: RouteDiscoveryStrategy = {
  name: "static-baseline-list",
  async discoverRoutes(config: GuardianConfig): Promise<DiscoveredRoute[]> {
    const { loadBaseline } = await import("../baseline/loadBaseline");
    const { index } = loadBaseline(config.baselineDir);

    return index.pages.map((entry) => ({
      slug: entry.slug,
      path: new URL(entry.pageUrl).pathname + new URL(entry.pageUrl).hash,
    }));
  },
};
