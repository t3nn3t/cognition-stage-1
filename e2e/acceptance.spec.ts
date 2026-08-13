import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function switchIdentity(page: Page, name: string) {
  const accountButton = page.getByRole("banner").getByRole("button").first();
  if (await accountButton.getByText(name, { exact: true }).isVisible()) {
    return;
  }
  const previousUrl = page.url();
  await accountButton.click();
  await page.getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(accountButton.getByText(name, { exact: true })).toBeVisible();
  // Switching identity always returns to the Overview page.
  await expect(page).toHaveURL(/\/$/);
  if (new URL(previousUrl).pathname !== "/") {
    await page.goto(previousUrl);
  }
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

  // 1. A refund above the original charge is blocked outright.
  await page.goto("/refunds");
  await page.getByRole("link", { name: "Daniel Okafor" }).click();
  await page.getByLabel("Refund amount (USD)").fill("99999");
  await page.getByRole("button", { name: "Request refund" }).click();
  await expect(
    page.getByText("A refund cannot exceed the original charge amount."),
  ).toBeVisible();

  // 2. Maya requests a $1,250 refund with a reason; it remains pending.
  await page.getByLabel("Refund amount (USD)").fill("1250");
  await page
    .getByLabel("Reason")
    .fill("Chargeback settled in the customer's favour");
  await page.getByRole("button", { name: "Request refund" }).click();
  await expect(page.getByText("Pending approval").first()).toBeVisible();
  await expect(page.getByText("$1,250.00").first()).toBeVisible();

  // 3. Maya cannot approve her own request; the button is greyed out.
  const selfApprove = page.getByRole("button", {
    name: "Approve",
    exact: true,
  });
  await expect(selfApprove).toBeDisabled();
  await expect(
    page.locator('form[title="A requester cannot approve their own request."]'),
  ).toBeVisible();
  await expect(page.getByText("Pending approval").first()).toBeVisible();

  // 4. Theo approves it (switching lands on Overview, then returns).
  await switchIdentity(page, "Theo Grant");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Request approved.")).toBeVisible();
  await expect(page.getByText("Approved by Theo Grant")).toBeVisible();

  // 5. The payment adapter executes exactly once.
  await page.getByRole("button", { name: "Execute refund" }).click();
  await expect(page.getByText("Change executed.")).toBeVisible();
  await expect(
    page.getByText("Executed", { exact: true }).first(),
  ).toBeVisible();

  // 6. Retrying execution returns the original provider result.
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

test("high-risk KYC decision routes to Theo for Compliance approval", async ({
  page,
}) => {
  await page.goto("/kyc");
  await switchIdentity(page, "Maya Chen");
  await page.getByRole("link", { name: "Ravi Narayanan" }).click();
  await page
    .getByRole("group", { name: "Decision" })
    .getByText("Approve", { exact: true })
    .click();
  await page
    .getByLabel("Reason")
    .fill("Watchlist match reviewed; identity documents verified");
  await page.getByRole("button", { name: "Submit decision" }).click();
  await expect(page.getByText("Requires Compliance")).toBeVisible();

  await switchIdentity(page, "Theo Grant");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Request approved.")).toBeVisible();
  await expect(page.getByText("Approved by Theo Grant")).toBeVisible();
});

test("production flag change: 10% to 100% routes to the release approver", async ({
  page,
}) => {
  await page.goto("/flags");
  await switchIdentity(page, "Maya Chen");
  await page.getByRole("link", { name: "instant-payouts" }).first().click();

  // Any production increase is accepted and routed to the Release Approver.
  await page.getByLabel("Proposed rollout (%)").fill("100");
  await page.getByRole("button", { name: "Propose change" }).click();
  await expect(page.getByText("Requires Release")).toBeVisible();
  await expect(page.getByText("10% → 100%")).toBeVisible();

  await switchIdentity(page, "Priya Shah");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Approved by Priya Shah")).toBeVisible();
});

test("approver personas cannot submit requests or act outside their role", async ({
  page,
}) => {
  // Priya (Release Approver) cannot request refunds.
  await page.goto("/refunds");
  await switchIdentity(page, "Priya Shah");
  await page.getByRole("link", { name: "Sofia Almeida" }).click();
  await expect(
    page.getByText("Only operations team members can request refunds."),
  ).toBeVisible();
  await expect(page.getByLabel("Refund amount (USD)")).toHaveCount(0);

  // Theo cannot execute the approved flag change (needs Release Approver).
  await switchIdentity(page, "Theo Grant");
  await page.goto("/flags");
  await page.getByRole("link", { name: "instant-payouts" }).first().click();
  await expect(page.getByText("Approved by Priya Shah")).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply change" })).toHaveCount(
    0,
  );
});

test("activity shows allowed and blocked attempts in human-readable form", async ({
  page,
}) => {
  await page.goto("/activity");
  await expect(
    page.getByText("Requested a refund of $1,250.00 for order ORD-48213"),
  ).toBeVisible();

  await page.goto("/activity?outcome=blocked");
  await expect(page.getByText("Attempt blocked").first()).toBeVisible();
  await expect(
    page.getByText("Refund request for order ORD-48213 was blocked", {
      exact: false,
    }),
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
