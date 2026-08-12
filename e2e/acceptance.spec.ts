import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function switchIdentity(page: Page, name: string) {
  const accountButton = page.getByRole("banner").getByRole("button").first();
  if (await accountButton.getByText(name, { exact: true }).isVisible()) {
    return;
  }
  await accountButton.click();
  await page.getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(accountButton.getByText(name, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  const response = await request.post("/dev/reset");
  expect(response.ok()).toBeTruthy();
});

test("refund journey: request, blocked self-approval, approval, execution, idempotent replay", async ({
  page,
}) => {
  await page.goto("/");
  await switchIdentity(page, "Maya Chen");

  // 1. Maya requests a $1,250 refund with a reason; it remains pending.
  await page.goto("/refunds");
  await page.getByRole("link", { name: "Daniel Okafor" }).click();
  await page.getByLabel("Refund amount (USD)").fill("1250");
  await page
    .getByLabel("Reason")
    .fill("Chargeback settled in the customer's favour");
  await page.getByRole("button", { name: "Request refund" }).click();
  await expect(page.getByText("Pending approval").first()).toBeVisible();
  await expect(page.getByText("$1,250.00").first()).toBeVisible();

  // 2. Maya cannot approve her own request; the blocked attempt is recorded.
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(
    page.getByText("A requester cannot approve their own request.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Pending approval").first()).toBeVisible();
  await expect(page.getByText("Attempt blocked").first()).toBeVisible();

  // 3. Theo approves it.
  await switchIdentity(page, "Theo Grant");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Request approved.")).toBeVisible();
  await expect(page.getByText("Approved by Theo Grant")).toBeVisible();

  // 4. The payment adapter executes exactly once.
  await page.getByRole("button", { name: "Execute refund" }).click();
  await expect(page.getByText("Change executed.")).toBeVisible();
  await expect(
    page.getByText("Executed", { exact: true }).first(),
  ).toBeVisible();

  // 5. Retrying execution returns the original provider result.
  await page.getByRole("button", { name: "Retry execution" }).click();
  await expect(
    page.getByText(
      "This request was already executed; the original result was returned without a second execution.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Execution replayed").first()).toBeVisible();

  // The screenshot-ready detail page: amount, High risk, Executed,
  // requester Maya, approver Theo, and the event timeline.
  await expect(page.getByText("$1,250.00").first()).toBeVisible();
  await expect(page.getByText("High risk").first()).toBeVisible();
  await expect(page.getByText("Maya Chen").first()).toBeVisible();
  await expect(page.getByText("Approved by Theo Grant")).toBeVisible();
  await expect(page.getByText("Execution completed").first()).toBeVisible();
});

test("high-risk KYC decision routes to Priya for Compliance approval", async ({
  page,
}) => {
  await page.goto("/kyc");
  await switchIdentity(page, "Maya Chen");
  await page.getByRole("link", { name: "Ravi Narayanan" }).click();
  await page.getByLabel("Decision").selectOption({ label: "Approve" });
  await page
    .getByLabel("Reason")
    .fill("Watchlist match reviewed; identity documents verified");
  await page.getByRole("button", { name: "Submit decision" }).click();
  await expect(page.getByText("Requires Compliance Officer")).toBeVisible();

  await switchIdentity(page, "Priya Shah");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Request approved.")).toBeVisible();
  await expect(page.getByText("Approved by Priya Shah")).toBeVisible();
});

test("production flag change: 10% to 100% is rejected by policy; 10% to 35% routes to Alex", async ({
  page,
}) => {
  await page.goto("/flags");
  await switchIdentity(page, "Maya Chen");
  await page.getByRole("link", { name: "instant-payouts" }).first().click();

  // 10% → 100% is blocked by the rollout-increase policy.
  await page.getByLabel("Proposed rollout (%)").fill("100");
  await page.getByLabel("Reason").fill("Full rollout of instant payouts");
  await page.getByRole("button", { name: "Propose change" }).click();
  await expect(
    page.getByText(
      "A production rollout cannot increase by more than 25 percentage points in one change.",
    ),
  ).toBeVisible();

  // 10% → 35% is accepted and routed to the Release Manager.
  await page.getByLabel("Proposed rollout (%)").fill("35");
  await page.getByLabel("Reason").fill("Gradual rollout of instant payouts");
  await page.getByRole("button", { name: "Propose change" }).click();
  await expect(page.getByText("Requires Release Manager")).toBeVisible();
  await expect(page.getByText("10% → 35%")).toBeVisible();

  await switchIdentity(page, "Alex Morgan");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Approved by Alex Morgan")).toBeVisible();
});

test("activity shows allowed and blocked attempts in human-readable form", async ({
  page,
}) => {
  await page.goto("/activity");
  await expect(
    page.getByText("Requested a refund of $1,250.00 for order ORD-48213"),
  ).toBeVisible();
  await expect(
    page
      .getByText("Approval attempt was blocked: A requester cannot approve", {
        exact: false,
      })
      .first(),
  ).toBeVisible();

  await page.goto("/activity?outcome=blocked");
  await expect(page.getByText("Attempt blocked").first()).toBeVisible();
  await expect(
    page.getByText(
      "Rollout change for instant-payouts (production) was blocked",
      { exact: false },
    ),
  ).toBeVisible();
});

test("reseeding restores the deterministic starting state", async ({
  page,
  request,
}) => {
  const response = await request.post("/dev/reset");
  expect(response.ok()).toBeTruthy();

  await page.goto("/refunds");
  await expect(page.getByText("No request").first()).toBeVisible();
  await page.goto("/flags");
  await expect(page.getByText("10%", { exact: true })).toBeVisible();
  await page.goto("/activity");
  await expect(page.getByText("No matching activity")).toBeVisible();
});
