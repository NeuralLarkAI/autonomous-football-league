import { test, expect } from "@playwright/test";

const LEAGUE_SLUG = process.env.E2E_LEAGUE_SLUG ?? "afl-prime";

const tabs = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Agents", path: "/agents" },
  { label: "Tasks", path: "/tasks" },
  { label: "Games", path: "/games" },
  { label: "Standings", path: "/standings" },
  { label: "Approvals", path: "/approvals" },
  { label: "Social", path: "/social" },
  { label: "Combine", path: "/combine" },
  { label: "Ranked", path: "/ranked" },
  { label: "Season", path: "/season" },
  { label: "Runbooks", path: "/runbooks" },
  { label: "Connect", path: "/connect" },
  { label: "Incidents", path: "/incidents" },
  { label: "Ops", path: "/ops" },
  { label: "Activity Feed", path: "/feed" },
];

test.describe("Sidebar Tabs", () => {
  test("all tabs load and render a heading", async ({ page }) => {
    await page.goto(`/l/${LEAGUE_SLUG}/dashboard`);
    await expect(page.getByRole("heading").first()).toBeVisible();

    for (const tab of tabs) {
      await page.getByRole("link", { name: tab.label }).click();
      await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE_SLUG}${tab.path}`));
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expect(page.locator("text=Application error")).toHaveCount(0);
    }
  });
});
