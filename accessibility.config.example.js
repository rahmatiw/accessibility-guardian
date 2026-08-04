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
  //
  // Selectors below were verified 2026-08-04 against a real rendered login page at
  // http://spvithlani.investwellfront.com/app/#/login (a reachable local/dev
  // environment — NOT demo.investwell.app, which is production and must never be
  // an automated scan target). Note that URL is investwellFront's domain, not
  // frontend-client's — confirm these selectors still match before relying on them
  // for frontend-client specifically; they were captured by launching a real headless
  // browser and inspecting the rendered DOM, not guessed.
  auth: {
    strategy: "credentials",
    loginPath: "/app/#/login",
    usernameSelector: 'input[name="email"]',
    passwordSelector: 'input[name="password"]',
    submitSelector: "#signinButton",
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
