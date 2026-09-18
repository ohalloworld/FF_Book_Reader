import { expect, test } from "@playwright/test";

test("a pool stat's max can be raised, carrying current up with it, and current still clamps to the new max", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Play$/ })
    .first()
    .click();
  await page.locator("#hero-name").fill("MaxTest");
  await page.getByRole("button", { name: "Begin a new adventure" }).click();
  await page.getByRole("heading", { name: "Roll your Adventure Sheet" }).waitFor();
  await page.getByRole("button", { name: "Begin the adventure" }).click();

  await page.getByRole("button", { name: /MaxTest/ }).click();
  await page.waitForSelector(".character-sheet");

  const skillStat = page.locator(".stat", { hasText: "SKILL" });
  const before = (await skillStat.locator(".stat-value").textContent()) ?? "";
  const [beforeCurrent, beforeMax] = before.split("/").map((n) => Number(n.trim()));

  // Raise the max by 2 via the dedicated "Max" stepper -- distinct from the
  // regular current-value stepper above it.
  await skillStat.locator(".stat-max-adjuster input").fill("2");
  await skillStat.locator(".stat-max-adjuster .stat-adjust-button").nth(1).click();

  await expect(skillStat.locator(".stat-value")).toHaveText(`${beforeCurrent + 2} / ${beforeMax + 2}`);

  // The ordinary current-value stepper still can't push current past the
  // (now-higher) max.
  await skillStat.locator(".stat-adjuster").first().locator("input").fill("5");
  await skillStat.locator(".stat-adjuster").first().locator(".stat-adjust-button").nth(1).click();
  await expect(skillStat.locator(".stat-value")).toHaveText(`${beforeMax + 2} / ${beforeMax + 2}`);
});
