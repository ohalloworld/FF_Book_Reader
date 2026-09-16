import { expect, test } from "@playwright/test";
import { stubMaxDice } from "./helpers";

async function beginAdventureAndFillFirstMonster(page: import("@playwright/test").Page) {
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
}

test("sequential mode (the default) only lets you fight the current monster; the rest wait", async ({ page }) => {
  await beginAdventureAndFillFirstMonster(page);

  // Maxed dice -> SKILL = 12. Both goblins have SKILL 5, well below the
  // player's, so the player always wins and 2 hits (STAMINA 4, damagePerHit
  // 2) defeats each one.
  await page.locator('input[placeholder="Monster name"]').fill("Goblin A");
  await page.locator('input[placeholder="SKILL"]').fill("5");
  await page.locator('input[placeholder="STAMINA"]').fill("4");
  await page.getByRole("button", { name: "Add another monster" }).click();
  await page.locator('input[placeholder="Monster name"]').fill("Goblin B");
  await page.locator('input[placeholder="SKILL"]').fill("5");
  await page.locator('input[placeholder="STAMINA"]').fill("4");

  await expect(page.getByRole("radio", { name: /One at a time/ })).toBeChecked();
  await page.getByRole("button", { name: "Start Combat" }).click();

  // Only the front monster (Goblin A) can be fought; Goblin B waits.
  await expect(page.getByRole("button", { name: "Attack Goblin A" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attack Goblin B" })).toHaveCount(0);
  await expect(page.locator(".monster-row", { hasText: "Goblin B" })).toContainText("Waiting");

  const staminaBefore = Number((await page.locator(".stat-bar-strip").textContent())?.match(/STAMINA(\d+)/)?.[1]);

  await page.getByRole("button", { name: "Attack Goblin A" }).click();
  await page.getByRole("button", { name: "Attack Goblin A" }).click();

  // Goblin A is defeated; Goblin B becomes the front monster and can now
  // be fought, having never acted at all while it was waiting.
  await expect(page.locator(".monster-row", { hasText: "Goblin A" })).toContainText("Defeated");
  await expect(page.getByRole("button", { name: "Attack Goblin B" })).toBeVisible();

  const staminaAfter = Number((await page.locator(".stat-bar-strip").textContent())?.match(/STAMINA(\d+)/)?.[1]);
  expect(staminaAfter).toBe(staminaBefore);
});

test("simultaneous mode (opt-in) has every living monster attack back each round", async ({ page }) => {
  await beginAdventureAndFillFirstMonster(page);

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

  await page.getByRole("radio", { name: /All of them attack/ }).check();
  await page.getByRole("button", { name: "Start Combat" }).click();

  // Both monsters can be targeted in this mode.
  await expect(page.getByRole("button", { name: "Attack Goblin A" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attack Goblin B" })).toBeVisible();

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
