import { expect, test } from "@playwright/test";

test("character stats are genuinely rolled and reroll changes them", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Play$/ })
    .first()
    .click();
  await page.locator("#hero-name").fill("Rolla");
  await page.getByRole("button", { name: "Begin a new adventure" }).click();
  await page.getByRole("heading", { name: "Roll your Adventure Sheet" }).waitFor();

  const before = await page.locator(".character-roll-stat-value").allTextContents();
  await page.getByRole("button", { name: "Reroll" }).click();
  const after = await page.locator(".character-roll-stat-value").allTextContents();
  expect(before).not.toEqual(after);

  await page.getByRole("button", { name: "Begin the adventure" }).click();
  await expect(page.locator(".stat-bar-strip")).toContainText(`SKILL${after[0]}/${after[0]}`);
});
