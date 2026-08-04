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

/**
 * Generic credentials-based login: fills a username/password form and submits it.
 * Deliberately configurable rather than hardcoded to any one app's login DOM.
 * `loginPath`/`usernameSelector`/`passwordSelector`/`submitSelector` were verified
 * 2026-08-04 against http://spvithlani.investwellfront.com/app/#/login (reachable
 * local/dev env) by launching a real headless browser and inspecting the rendered
 * DOM — demo.investwell.app is production, returned 403 to this environment, and
 * must never be an automated scan target regardless. `username`/`password` are real
 * secrets and must come from env vars, never hardcoded in accessibility.config.js.
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

  // A successful login navigates away from the login route entirely (verified
  // 2026-08-04: spvithlani.investwellfront.com redirects /app/#/login -> plain
  // /client/dashboard, no hash) — waiting for networkidle alone would "succeed" even
  // on wrong credentials, since the login page itself settles into an idle state
  // with an inline error message rather than failing to load.
  const postLoginUrlIncludes = (auth.postLoginUrlIncludes as string) ?? "/client/";
  try {
    await page.waitForURL((url) => url.toString().includes(postLoginUrlIncludes), {
      timeout: 15000,
    });
  } catch {
    const evidence = await captureFailureEvidence(page, reportDir, "login-failure");
    throw new Error(
      `Login did not navigate to a URL containing "${postLoginUrlIncludes}" within 15s — still on ` +
        `${page.url()}.\n\n` +
        "This does NOT necessarily mean the credentials are wrong — see the captured evidence below " +
        "for what was actually on screen (an inline validation error, a CAPTCHA, an unexpected extra " +
        "step, the click landing on the wrong element, etc.) before assuming that.\n\n" +
        evidence
    );
  }

  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    // Same reasoning as gotoAndSettle: don't fail an already-successful login just
    // because some background connection (analytics, etc.) never quiesces.
  }
}
