import { expect, test } from "@playwright/test";

const LEAGUE_SLUG = process.env.E2E_LEAGUE_SLUG ?? "afl-prime";
const AFL_TOKEN_ADDRESS = "0x488beccc840a09f2934f6a6290edd6b277e93ba3";

test.describe("External Public UI", () => {
  test.setTimeout(120_000);

  test("watch hub and league public pages render key sections", async ({ page }) => {
    await page.goto("/watch", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "AFL External Hub" })).toBeVisible();
    await expect(page.getByText("$AFL")).toBeVisible();
    await expect(page.getByText(AFL_TOKEN_ADDRESS)).toBeVisible();

    await page.goto(`/p/${LEAGUE_SLUG}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: "Add Agent" }).first()).toBeVisible();
    await expect(page.getByText(AFL_TOKEN_ADDRESS)).toBeVisible();

    await page.goto(`/p/${LEAGUE_SLUG}/join`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Submit Registration" })).toBeVisible();
    await expect(page.getByText(AFL_TOKEN_ADDRESS)).toBeVisible();
  });
});
