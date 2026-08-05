import type { BrowserContext, Page } from "playwright";
import { AuthConfig } from "../config/types";

/**
 * Some apps' login only reaches a broker/admin session, not the client session the
 * baseline's routes actually need — confirmed 2026-08-05 against
 * spvithlani.investwellfront.com: this account's login lands on /broker/dashboard,
 * and reaching /client/... requires a broker-initiated "view as client" handoff.
 *
 * Flow (real selectors captured from actual DOM, not guessed):
 *   1. Click the "Clients" nav item.
 *   2. Click a client row matching auth.clientSearchText — opens a profile modal.
 *   3. Click the modal's "Dashboard" quick-link (a[metatitle="feature2dashboard"] —
 *      NOT the visually similar per-row hover action a.gotoDashboard
 *      [metatitle="feature2ClientDashboard"], which is a different element for a
 *      different purpose and isn't clickable the same way).
 *   4. That link opens a NEW browser tab/page at /client/dashboard?uid=...&levelNo=...
 *      — return that page. Session persists via cookies from there: every other
 *      /client/... route (including the baseline's plain, uid-less paths) works
 *      directly on this same page, confirmed by navigating to
 *      /client/mfuNewInvestment/allSchemes with no uid param and getting a fully
 *      rendered, authenticated page.
 *
 * If auth.clientSearchText isn't set, this is skipped entirely and the broker page
 * itself is used for scanning (correct for apps where login reaches /client/ directly).
 */
export async function resolveClientSession(
  brokerPage: Page,
  context: BrowserContext,
  auth: AuthConfig
): Promise<Page> {
  const clientSearchText = auth.clientSearchText as string | undefined;
  if (!clientSearchText) return brokerPage;

  const clientsNavSelector = (auth.clientsNavSelector as string) ?? "text=Clients";
  const dashboardQuickLinkSelector =
    (auth.clientDashboardLinkSelector as string) ?? 'a[metatitle="feature2dashboard"]';

  await brokerPage.locator(clientsNavSelector).first().click();
  await brokerPage.waitForTimeout(2000);

  await brokerPage.getByText(clientSearchText, { exact: false }).first().click();
  await brokerPage.waitForTimeout(1500);

  const dashboardLink = brokerPage.locator(dashboardQuickLinkSelector).first();
  await dashboardLink.waitFor({ state: "visible", timeout: 10000 });

  const [clientPage] = await Promise.all([
    context.waitForEvent("page", { timeout: 15000 }),
    dashboardLink.click(),
  ]);

  await clientPage.waitForLoadState("domcontentloaded");
  return clientPage;
}
