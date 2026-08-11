// Copy this file to <your-repo>/accessibility.config.js and adjust.
// See src/config/types.ts (GuardianConfig) for the full shape.
//
// Nothing account/environment-specific is hardcoded here — every value below that's
// specific to a real login comes from an env var with NO fallback default. Silently
// defaulting to "the one account that happened to work last time" makes the tool feel
// broken for anyone else who runs it without that exact same account; require it
// explicitly instead, so it's clear what has to be supplied.

const { staticBaselineListStrategy } = require("accessibility-guardian/dist/routeDiscovery/staticList");

module.exports = {
  app: "frontend-client",
  environment: process.env.A11Y_ENVIRONMENT,
  baseURL: process.env.A11Y_BASE_URL,

  // How the scanner logs in. Left loose/repo-specific on purpose — see
  // src/config/types.ts AuthConfig. Real test credentials only ever come from env
  // vars, never hardcoded here.
  //
  // Two possible shapes, depending on what kind of account you're using:
  //
  // 1. Single-step login (account logs straight into /client/...): only
  //    loginPath/usernameSelector/passwordSelector/submitSelector/username/password
  //    are needed. Remove postLoginUrlIncludes/clientSearchText/mobile*/otp* entirely.
  //
  // 2. Broker account with a mobile/OTP step + broker->client handoff (frontend-client's
  //    real setup, verified 2026-08-05): the account logs into /broker/..., not
  //    /client/..., and needs an extra "view as client" step
  //    (src/scanner/clientImpersonation.ts) to reach the pages the baseline covers.
  //    mobileNumber MUST be the real number registered to that specific account — this
  //    step does a genuine per-account lookup and rejects any other number ("No user
  //    found"), there's no way to skip or guess past it.
  auth: {
    strategy: "credentials",
    loginPath: "/app/#/login",
    usernameSelector: 'input[name="email"]',
    passwordSelector: 'input[name="password"]',
    submitSelector: "#signinButton",
    username: process.env.A11Y_TEST_USER,
    password: process.env.A11Y_TEST_PASSWORD,

    // Only needed for shape 2 above (broker account with mobile/OTP + handoff):
    mobileSelector: 'input[name="mobile"]',
    mobileSubmitSelector: 'input[type="submit"][value="Send OTP"]',
    mobileNumber: process.env.A11Y_TEST_MOBILE,
    otpValue: "123456", // arbitrary if this environment doesn't validate the OTP itself — confirm for yours
    postLoginUrlIncludes: "/broker/",
    clientSearchText: process.env.A11Y_TEST_CLIENT,
  },

  // Built-in strategy: scans exactly the pages already tracked in this repo's
  // accessibility/baseline/. Swap for a framework-aware strategy later if you want
  // newly-added routes auto-discovered (they still won't be auto-baselined — see §8).
  routeDiscovery: staticBaselineListStrategy,

  baselineDir: `${__dirname}/accessibility/baseline`,
  reportDir: `${__dirname}/accessibility/reports`,
};
