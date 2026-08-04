// Copy this file to <your-repo>/accessibility.config.js and adjust.
// See src/config/types.ts (GuardianConfig) for the full shape.

const { staticBaselineListStrategy } = require("accessibility-guardian/dist/routeDiscovery/staticList");

module.exports = {
  app: "frontend-client",
  environment: process.env.A11Y_ENV || "uat",
  baseURL: process.env.A11Y_BASE_URL || "https://demo.investwell.app",

  // How the scanner logs in. Left loose/repo-specific on purpose — see
  // src/config/types.ts AuthConfig. Fill in with real test credentials via env vars,
  // never commit credentials directly into this file.
  auth: {
    strategy: "credentials",
    username: process.env.A11Y_TEST_USER,
    password: process.env.A11Y_TEST_PASSWORD,
  },

  // Built-in strategy: scans exactly the pages already tracked in this repo's
  // accessibility/baseline/. Swap for a framework-aware strategy later if you want
  // newly-added routes auto-discovered (they still won't be auto-baselined — see §8).
  routeDiscovery: staticBaselineListStrategy,

  baselineDir: `${__dirname}/accessibility/baseline`,
  reportDir: `${__dirname}/accessibility/reports`,
};
