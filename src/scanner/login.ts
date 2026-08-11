import fs from "fs";
import path from "path";
import type { Page } from "playwright";
import { AuthConfig } from "../config/types";
import { gotoAndSettle } from "./navigate";

async function captureFailureEvidence(page: Page, reportDir: string, label: string): Promise<string> {
  fs.mkdirSync(reportDir, { recursive: true });
  const screenshotPath = path.join(reportDir, `${label}.png`);
  const htmlPath = path.join(reportDir, `${label}.html`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  await fs
    .promises.writeFile(htmlPath, await page.content().catch(() => "(could not capture HTML)"))
    .catch(() => {});
  const visibleText = await page
    .evaluate(() => document.body?.innerText?.slice(0, 2000) ?? "")
    .catch(() => "(could not read page text)");
  return `Screenshot: ${screenshotPath}\nHTML dump: ${htmlPath}\nVisible page text (first 2000 chars):\n${visibleText}`;
}

type StepOutcome = "navigated" | "mobileStep";

async function waitForNavigationOrMobileStep(
  page: Page,
  postLoginUrlIncludes: string,
  mobileSelector: string,
  timeout: number
): Promise<StepOutcome> {
  return Promise.any([
    page
      .waitForURL((url) => url.toString().includes(postLoginUrlIncludes), { timeout })
      .then((): StepOutcome => "navigated"),
    page.waitForSelector(mobileSelector, { timeout, state: "visible" }).then((): StepOutcome => "mobileStep"),
  ]);
}

/**
 * Best-effort OTP fill: this environment accepts any OTP value (confirmed by the user
 * for spvithlani.investwellfront.com — it's a dev/local env, not real SMS-backed), so
 * correctness here is about *finding* the right input(s), not the value. Handles the
 * two common OTP UI shapes: a single field, or N separate single-digit boxes. Real
 * selectors are unknown (this step wasn't reachable before the mobile-number step was
 * added) — override via auth.otpSelector / auth.otpDigitBoxSelector if this guess is
 * wrong; failure captures evidence the same way the mobile/credentials steps do.
 */
async function fillOtp(page: Page, auth: AuthConfig, otpValue: string): Promise<boolean> {
  if (auth.otpSelector) {
    const el = page.locator(auth.otpSelector as string).first();
    if ((await el.count()) > 0) {
      await el.fill(otpValue);
      return true;
    }
  }

  if (auth.otpDigitBoxSelector) {
    const boxes = page.locator(auth.otpDigitBoxSelector as string);
    const count = await boxes.count();
    if (count > 0) {
      for (let i = 0; i < count && i < otpValue.length; i++) {
        // pressSequentially, not fill: separate digit boxes almost always rely on
        // real keyup/keydown events (to auto-advance focus and to flip the parent
        // form's "OTP complete" state that enables the submit button) — fill() sets
        // the value directly without firing those. Verified 2026-08-05: fill()
        // populated all 6 boxes visually but left "Confirm OTP" disabled.
        await boxes.nth(i).pressSequentially(otpValue[i]);
      }
      return true;
    }
  }

  // Auto-detect: N separate maxlength=1 boxes is the most common OTP pattern.
  const digitBoxes = page.locator('input[maxlength="1"]');
  const digitBoxCount = await digitBoxes.count();
  if (digitBoxCount >= 4 && digitBoxCount <= 8) {
    for (let i = 0; i < digitBoxCount; i++) {
      await digitBoxes.nth(i).pressSequentially(otpValue[i % otpValue.length]);
    }
    return true;
  }

  // Auto-detect: a single field labeled/named something OTP-ish.
  const singleField = page.locator(
    'input[name*="otp" i], input[aria-label*="otp" i], input[placeholder*="otp" i], input[id*="otp" i]'
  );
  if ((await singleField.count()) > 0) {
    await singleField.first().fill(otpValue);
    return true;
  }

  return false;
}

async function submitOtp(page: Page, auth: AuthConfig): Promise<boolean> {
  if (auth.otpSubmitSelector) {
    const el = page.locator(auth.otpSubmitSelector as string).first();
    if ((await el.count()) > 0) {
      await el.click();
      return true;
    }
  }
  const generic = page.locator('button[type="submit"], input[type="submit"]').first();
  if ((await generic.count()) > 0) {
    await generic.click();
    return true;
  }
  return false;
}

/**
 * Generic credentials-based login: fills a username/password form, submits it, and
 * handles a second mobile-number + OTP step if the app presents one (confirmed via a
 * real run against spvithlani.investwellfront.com on 2026-08-04 — the app moves from
 * email+password straight to "Enter Mobile Number" before reaching /client/, which the
 * original single-step implementation didn't account for and misread as a login
 * failure). All selectors are configurable since they're app-specific; the ones below
 * were captured from real rendered DOM, not guessed, except where noted.
 */
export async function login(
  page: Page,
  baseURL: string,
  auth: AuthConfig,
  reportDir: string
): Promise<void> {
  if (auth.strategy === "none") return;

  if (auth.strategy === "token") {
    throw new Error(
      'auth.strategy === "token" is not yet implemented — add token-injection logic here (e.g. setting a cookie or Authorization header) once the real auth mechanism is known.'
    );
  }

  if (auth.strategy !== "credentials") {
    throw new Error(`Unknown auth.strategy: ${String(auth.strategy)}`);
  }

  const required = ["loginPath", "usernameSelector", "passwordSelector", "submitSelector", "username", "password"];
  const missing = required.filter((key) => !auth[key]);
  if (missing.length > 0) {
    throw new Error(
      `auth.strategy is "credentials" but accessibility.config.js is missing: ${missing.join(", ")}. ` +
        "If it's username/password: set A11Y_TEST_USER / A11Y_TEST_PASSWORD (or whatever env vars " +
        "your config reads) before running scan — never hardcode real credentials in the config file. " +
        "If it's a selector/loginPath: it needs to be captured from the real login form (see login.ts)."
    );
  }

  await gotoAndSettle(page, new URL(auth.loginPath as string, baseURL).toString());
  await page.waitForSelector(auth.usernameSelector as string, { timeout: 30000 });
  await page.fill(auth.usernameSelector as string, auth.username as string);
  await page.fill(auth.passwordSelector as string, auth.password as string);
  await page.click(auth.submitSelector as string);

  const postLoginUrlIncludes = (auth.postLoginUrlIncludes as string) ?? "/client/";
  // Verified 2026-08-04: input[name="mobile"] + input[type=submit][value="Send OTP"]
  // on spvithlani.investwellfront.com's post-credentials step.
  const mobileSelector = (auth.mobileSelector as string) ?? 'input[name="mobile"]';
  const mobileSubmitSelector =
    (auth.mobileSubmitSelector as string) ?? 'input[type="submit"][value="Send OTP"]';
  const otpValue = (auth.otpValue as string) ?? "123456";

  let outcome: StepOutcome;
  try {
    outcome = await waitForNavigationOrMobileStep(page, postLoginUrlIncludes, mobileSelector, 15000);
  } catch {
    const evidence = await captureFailureEvidence(page, reportDir, "login-failure");
    throw new Error(
      `After submitting credentials, neither navigated to a URL containing "${postLoginUrlIncludes}" ` +
        `nor found a mobile-number field ("${mobileSelector}") within 15s — still on ${page.url()}.\n\n` +
        "See the captured evidence below for what was actually on screen.\n\n" +
        evidence
    );
  }

  if (outcome === "mobileStep") {
    // Fail immediately and specifically if none was configured, rather than guessing —
    // verified 2026-08-05 (twice, against two different accounts) that this step does a
    // real per-account lookup and rejects any number not registered to it ("No user
    // found"), so a made-up number is guaranteed to fail anyway. This is the app's own
    // security gate, not something this tool can route around; every account that hits
    // this step needs its own real registered number supplied via auth.mobileNumber.
    if (!auth.mobileNumber) {
      const evidence = await captureFailureEvidence(page, reportDir, "mobile-step-no-number-configured");
      throw new Error(
        "This account requires a mobile number + OTP step, but no auth.mobileNumber is configured " +
          "(e.g. via an A11Y_TEST_MOBILE env var). This has to be the real number registered against " +
          "this specific account — there's no way to skip or guess past it, it's a real lookup the app " +
          `performs. See ${reportDir}/mobile-step-no-number-configured.png for the screen it's stuck on.`
      );
    }
    const mobileNumber = auth.mobileNumber as string;
    await page.fill(mobileSelector, mobileNumber);
    await page.click(mobileSubmitSelector);

    // Fail fast on a rejected mobile number (e.g. "No user found") instead of letting
    // the OTP-input search below time out with a confusing "couldn't find OTP field"
    // error that has nothing to do with the real problem.
    await page.waitForTimeout(1500);
    const rejectionText = await page
      .evaluate(() => document.body?.innerText ?? "")
      .then((text) => {
        const match = /no user found|invalid mobile|not registered|mobile.*not.*found/i.exec(text);
        return match ? match[0] : null;
      })
      .catch(() => null);
    if (rejectionText) {
      const evidence = await captureFailureEvidence(page, reportDir, "mobile-number-rejected");
      throw new Error(
        `Mobile number "${mobileNumber}" was rejected ("${rejectionText}"). Set auth.mobileNumber in ` +
          "accessibility.config.js (via an env var) to the real number registered against this test " +
          `account — see ${reportDir}/mobile-number-rejected.png for what was shown.`
      );
    }

    const otpFilled = await fillOtp(page, auth, otpValue).catch(() => false);
    if (!otpFilled) {
      const evidence = await captureFailureEvidence(page, reportDir, "otp-step-failure");
      throw new Error(
        "Mobile number submitted, but could not find an OTP input on the next screen using the " +
          "built-in auto-detection (single field, or 4-8 separate digit boxes). Set auth.otpSelector " +
          "or auth.otpDigitBoxSelector in accessibility.config.js to the real selector — see the " +
          "captured evidence below for what the screen actually looks like.\n\n" +
          evidence
      );
    }

    const otpSubmitted = await submitOtp(page, auth).catch(() => false);
    if (!otpSubmitted) {
      const evidence = await captureFailureEvidence(page, reportDir, "otp-submit-failure");
      throw new Error(
        "OTP filled, but could not find a submit/verify button. Set auth.otpSubmitSelector in " +
          "accessibility.config.js — see the captured evidence below.\n\n" +
          evidence
      );
    }

    try {
      await page.waitForURL((url) => url.toString().includes(postLoginUrlIncludes), { timeout: 15000 });
    } catch {
      const evidence = await captureFailureEvidence(page, reportDir, "post-otp-failure");
      throw new Error(
        `After submitting OTP, did not navigate to a URL containing "${postLoginUrlIncludes}" within ` +
          `15s — still on ${page.url()}.\n\n` +
          evidence
      );
    }
  }

  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    // Same reasoning as gotoAndSettle: don't fail an already-successful login just
    // because some background connection (analytics, etc.) never quiesces.
  }
}
