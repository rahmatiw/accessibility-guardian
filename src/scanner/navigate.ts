import type { Page } from "playwright";

/**
 * Navigates and waits for the page to settle, without depending on every resource
 * finishing — real apps often have long-lived third-party connections (analytics,
 * Google Sign-In, embedded widgets) that can keep the default `waitUntil: "load"` or
 * a strict `networkidle` wait pending indefinitely, well past a 30s timeout, even
 * though the actual app UI is ready almost immediately. Seen in practice against
 * spvithlani.investwellfront.com: page.goto() with default options timed out.
 *
 * Strategy: wait only for DOMContentLoaded (fast, reliable), then best-effort wait
 * for network idle with a short bounded timeout that's swallowed on failure rather
 * than propagated — a slow-to-settle background connection shouldn't fail an
 * otherwise-successful navigation.
 */
export async function gotoAndSettle(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    // Fine — proceed with whatever's rendered. Callers that need a specific element
    // present (e.g. a login form field) should explicitly wait for it, which has its
    // own independent auto-waiting timeout.
  }
}
