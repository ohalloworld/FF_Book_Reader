import { expect, test } from "@playwright/test";
import { stubMaxDice } from "./helpers";

test("every living monster attacks back each round, not just the one being targeted", async ({ page }) => {
  await stubMaxDice(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Play$/ })
    .first()
    .click();
  await page.locator("#hero-name").fill("Vic");
  await page.getByRole("button", { name: "Begin a new adventure" }).click();
  await page.getByRole("heading", { name: "Roll your Adventure Sheet" }).waitFor();
  await page.getByRole("button", { name: "Begin the adventure" }).click();

  // Maxed dice -> SKILL = 12. Both monsters have SKILL 20, well above the
  // player's, so both should land a hit every round regardless of which
  // one is being targeted.
  await page.locator('input[placeholder="Monster name"]').fill("Goblin A");
  await page.locator('input[placeholder="SKILL"]').fill("20");
  await page.locator('input[placeholder="STAMINA"]').fill("20");
  await page.getByRole("button", { name: "Add another monster" }).click();
  await page.locator('input[placeholder="Monster name"]').fill("Goblin B");
  await page.locator('input[placeholder="SKILL"]').fill("20");
  await page.locator('input[placeholder="STAMINA"]').fill("20");
  await page.getByRole("button", { name: "Start Combat" }).click();

  await expect(page.locator(".monster-row")).toHaveCount(2);

  const staminaBefore = Number((await page.locator(".stat-bar-strip").textContent())?.match(/STAMINA(\d+)/)?.[1]);

  await page.getByRole("button", { name: "Attack Goblin A" }).click();
  await expect(page.locator(".combat-log")).toContainText("Also hit by Goblin B!");

  const staminaAfter = Number((await page.locator(".stat-bar-strip").textContent())?.match(/STAMINA(\d+)/)?.[1]);
  // Goblin A (targeted) and Goblin B (bystander) both land a hit this
  // round -> 2x damagePerHit (2 each) = 4 STAMINA lost, not 2.
  expect(staminaBefore - staminaAfter).toBe(4);

  // Goblin B's own health is untouched -- the player only ever deals
  // damage to the monster they chose to attack.
  const goblinBRow = page.locator(".monster-row", { hasText: "Goblin B" });
  await expect(goblinBRow.locator(".stat-value")).toHaveText("20 / 20");
});
