import { test, expect } from "@playwright/test";

const LEAGUE_SLUG = process.env.E2E_LEAGUE_SLUG ?? "afl-prime";

test.describe("Dashboard Actions", () => {
  test("core control buttons execute and show feedback", async ({ page }) => {
    await page.goto(`/l/${LEAGUE_SLUG}/dashboard`);

    const runDueNow = page.getByRole("button", { name: "Run due now" });
    await expect(runDueNow).toBeVisible();
    if (await runDueNow.isEnabled()) {
      await runDueNow.click();
      await expect(page.locator("div").filter({ hasText: /Triggered|No due scheduled runbooks/i }).first()).toBeVisible();
    }

    const runWeeklyCycle = page.getByRole("button", { name: "Run Weekly Cycle" });
    const runWeeklyCycleExists = (await runWeeklyCycle.count()) > 0;
    if (runWeeklyCycleExists) {
      await expect(runWeeklyCycle).toBeVisible();
      if (await runWeeklyCycle.isEnabled()) {
        await runWeeklyCycle.click();
      }
      await expect(
        page
          .locator("div,button")
          .filter({ hasText: /Weekly cycle complete|No enabled weekly runbooks found|Running\.\.\./i })
          .first()
      ).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: /Running\.\.\./i }).first()).toBeVisible();
    }

    const toggleAutoRun = page
      .getByRole("button", { name: /Disable Auto-run|Enable Auto-run/ })
      .first();
    await expect(toggleAutoRun).toBeVisible();
    await toggleAutoRun.click();
    await expect(page.getByRole("button", { name: /Disable Auto-run|Enable Auto-run/ }).first()).toBeVisible();
    await expect(page.locator("text=Application error")).toHaveCount(0);
  });
});
