import { expect, test } from "@playwright/test";
import { stubMaxDice } from "./helpers";

test("combat modifiers apply to Attack Strength and persist across rounds", async ({ page }) => {
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

  // Maxed dice -> SKILL (1D6+6) = 12.
  await page.locator('input[placeholder="Monster name"]').fill("Ogre");
  await page.locator('input[placeholder="SKILL"]').fill("9");
  await page.locator('input[placeholder="STAMINA"]').fill("20");
  await page.getByRole("button", { name: "Start Combat" }).click();

  const enemyStepper = page.locator(".combat-modifier", { hasText: "Enemy rolls" });
  await enemyStepper.getByRole("button", { name: "Increase Enemy rolls" }).click();
  await enemyStepper.getByRole("button", { name: "Increase Enemy rolls" }).click();
  await enemyStepper.getByRole("button", { name: "Increase Enemy rolls" }).click();
  await expect(enemyStepper.locator(".combat-modifier-value")).toHaveText("+3");

  // Maxed 2D6 = 12 for both sides. Player AS = 12 + SKILL 12 + 0 = 24.
  // Monster AS = 12 + SKILL 9 + modifier 3 = 24 -> a draw.
  await page.getByRole("button", { name: "Attack Ogre" }).click();
  await expect(page.locator(".combat-log")).toContainText("You rolled 24 (Attack Strength) vs 24");
  await expect(page.locator(".combat-log")).toContainText("Neither side lands a blow.");

  // The modifier persists into the next round without being re-set, and
  // one more +1 tips the balance to a monster win.
  await enemyStepper.getByRole("button", { name: "Increase Enemy rolls" }).click();
  await page.getByRole("button", { name: "Attack Ogre" }).click();
  await expect(page.locator(".combat-log")).toContainText("You rolled 24 (Attack Strength) vs 25");
  await expect(page.locator(".combat-log")).toContainText("You are wounded!");
});
