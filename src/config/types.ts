import { PageScanResult } from "../scanner/types";

/**
 * A route-discovery strategy is pluggable per app, since each repo's router
 * setup differs (see docs: investwellFront uses React Router v4 with domain-split
 * route files; other repos may differ once audited).
 */
export interface RouteDiscoveryStrategy {
  name: string;
  discoverRoutes(config: GuardianConfig): Promise<DiscoveredRoute[]>;
}

export interface DiscoveredRoute {
  slug: string; // must match the baseline's page slug for diffing to work
  path: string; // path relative to baseURL
}

export interface AuthConfig {
  strategy: "credentials" | "token" | "none";
  // Left loose on purpose: how a repo's login actually works is repo-specific.
  // e.g. { strategy: "credentials", username: process.env.A11Y_TEST_USER, ... }
  [key: string]: unknown;
}

export interface GuardianConfig {
  app: string; // e.g. "frontend-client"
  environment: string;
  baseURL: string;
  auth: AuthConfig;
  routeDiscovery: RouteDiscoveryStrategy;
  baselineDir: string; // path to this repo's accessibility/baseline/
  reportDir: string; // where to write the Markdown + JSON report
}

export type { PageScanResult };
