import { test, expect } from "@playwright/test";

const LEAGUE_SLUG = process.env.E2E_LEAGUE_SLUG ?? "afl-prime";

test.describe("Approvals", () => {
  test("approve/reject buttons return visible outcome", async ({ page, request }) => {
    const now = Date.now();
    await request.post("/api/proposals", {
      data: {
        title: `E2E Approval Smoke ${now}`,
        summary: "E2E approval smoke test proposal.",
        tier: 2,
        changeType: "POLICY",
        affectedArea: "OPS",
        beforeJson: "{\"state\":\"before\"}",
        afterJson: "{\"state\":\"after\"}",
        risk: "low",
        testPlan: "e2e",
        rollbackPlan: "rollback",
        requiredSignoffs: ["commissioner", "integrity"],
        creatorAgentId: "commissioner",
      },
    });

    await page.goto(`/l/${LEAGUE_SLUG}/approvals`);

    const approveButton = page.getByRole("button", { name: "Approve" }).first();
    await expect(approveButton).toBeVisible();
    await approveButton.click();

    const outcome = page
      .locator("div")
      .filter({
        hasText:
          /Approval approved|Required signoffs missing|Failed to approve|Approval is not pending|Missing signoffs/i,
      })
      .first();
    await expect(outcome).toBeVisible();

    const rejectButtons = page.getByRole("button", { name: "Reject" });
    const rejectCount = await rejectButtons.count();
    if (rejectCount > 0) {
      const rejectButton = rejectButtons.first();
      await expect(rejectButton).toBeVisible();
      await rejectButton.click();

      await expect(
        page
          .locator("div")
          .filter({ hasText: /Approval rejected|Approval is not pending|Failed to reject/i })
          .first()
      ).toBeVisible();
    } else {
      await expect(page.getByText(/No pending approvals/i)).toBeVisible();
    }
  });
});
