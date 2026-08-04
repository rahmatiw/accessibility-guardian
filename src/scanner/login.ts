import type { Page } from "playwright";
import { AuthConfig } from "../config/types";

/**
 * Generic credentials-based login: fills a username/password form and submits it.
 * Deliberately configurable rather than hardcoded to frontend-client's actual login
 * DOM — this environment can't reach https://demo.investwell.app (403, likely
 * WAF/bot-protection or network-restricted) to inspect its real selectors, so the
 * exact `usernameSelector`/`passwordSelector`/`submitSelector`/`loginPath` need to be
 * filled in against the real app before this does anything useful. Until then this
 * throws with a clear message rather than silently no-op'ing.
 */
export async function login(page: Page, baseURL: string, auth: AuthConfig): Promise<void> {
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
        "These describe the real login form's selectors and must be filled in against the actual app " +
        "(this environment couldn't reach it to inspect them — see login.ts)."
    );
  }

  await page.goto(new URL(auth.loginPath as string, baseURL).toString());
  await page.fill(auth.usernameSelector as string, auth.username as string);
  await page.fill(auth.passwordSelector as string, auth.password as string);
  await page.click(auth.submitSelector as string);
  await page.waitForLoadState("networkidle");
}
