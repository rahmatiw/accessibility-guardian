import type { BrowserContext, Page } from "playwright";
import { AuthConfig } from "../config/types";

/**
 * Some apps' login only reaches a broker/admin session, not the client session the
 * baseline's routes actually need — confirmed 2026-08-05 against
 * spvithlani.investwellfront.com: this account's login lands on /broker/dashboard,
 * and reaching /client/... requires a broker-initiated "view as client" handoff.
 *
 * Flow (real selectors captured from actual DOM, not guessed):
 *   1. Click the "Clients" nav item -> the client list/finder table.
 *   2. Actually search for the client by name, rather than scanning visible rows —
 *      verified 2026-08-06: the client list is large and paginated (thousands of rows
 *      across both broker accounts tested), so a client not on the first page (e.g.
 *      "AVINASH JAGDISH", vs. the first-page "A B MANDHARA" this was originally built
 *      against) was silently never found by a plain getByText scan. The real search:
 *      click the Name column's search-toggle icon (revealed input has no stable
 *      selector by itself — id="voice" belongs to a DIFFERENT, mobile-only hidden
 *      search box, a red herring caught by testing), then the revealed
 *      th input[placeholder="Name"] needs pressSequentially (not fill — same class of
 *      issue as the OTP digit boxes) AND an actual Enter keypress to apply the filter.
 *   3. Click the now-filtered client row — opens a profile modal.
 *   4. Click the modal's "Dashboard" quick-link (a[metatitle="feature2dashboard"] —
 *      NOT the visually similar per-row hover action a.gotoDashboard
 *      [metatitle="feature2ClientDashboard"], which is a different element for a
 *      different purpose and isn't clickable the same way).
 *   5. That link opens a NEW browser tab/page at /client/dashboard?uid=...&levelNo=...
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
  const nameSearchIconSelector = (auth.clientNameSearchIconSelector as string) ?? '[metatitle="feature2NameSearchIcon"]';
  const nameSearchInputSelector = (auth.clientNameSearchInputSelector as string) ?? 'th input[placeholder="Name"]';
  const dashboardQuickLinkSelector =
    (auth.clientDashboardLinkSelector as string) ?? 'a[metatitle="feature2dashboard"]';

  await brokerPage.locator(clientsNavSelector).first().click();
  await brokerPage.waitForTimeout(2000);

  await brokerPage.locator(nameSearchIconSelector).first().click();
  const nameSearchInput = brokerPage.locator(nameSearchInputSelector).first();
  await nameSearchInput.waitFor({ state: "visible", timeout: 10000 });
  await nameSearchInput.click();
  await nameSearchInput.pressSequentially(clientSearchText, { delay: 30 });
  await nameSearchInput.press("Enter");
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
