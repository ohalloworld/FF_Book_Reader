import { expect, test } from "@playwright/test";
import { beginDemoAdventure, stubMaxDice } from "./helpers";

test("combat resolves round by round and reaches the victory ending", async ({ page }) => {
  await stubMaxDice(page);
  await beginDemoAdventure(page);

  // Maxed dice -> maxed stat generation: SKILL 1D6+6=12, STAMINA 2D6+12=24, LUCK 1D6+12=18.
  await expect(page.locator(".stat-bar-strip")).toContainText("SKILL12/12");
  await expect(page.locator(".stat-bar-strip")).toContainText("STAMINA24/24");
  await expect(page.locator(".stat-bar-strip")).toContainText("LUCK18/18");

  await page.getByRole("button", { name: "Push the door open and enter." }).click();
  await expect(page.locator(".section-number")).toHaveText("2");

  await page.getByRole("button", { name: "Follow the orange glow." }).click();
  // Section 6's luck test auto-resolves on entry (maxed roll 12 <= maxed luck 18 -> pass -> 7),
  // and decrements LUCK by 1 on use regardless of outcome.
  await expect(page.locator(".section-number")).toHaveText("7");
  await expect(page.locator(".stat-bar-strip")).toContainText("LUCK17/18");

  await page.getByRole("button", { name: "Drop down into the chamber." }).click();
  await expect(page.locator(".section-number")).toHaveText("9");
  await expect(page.locator(".combat-panel")).toBeVisible();
  await expect(page.locator(".monster-row")).toContainText("12 / 12");

  // Maxed dice -> player Attack Strength (12+12=24) always beats the
  // Fire-Demon's fixed skill 9 (12+9=21), so the monster always loses and
  // the player is never hit: 6 rounds of 2 damage clears its 12 STAMINA.
  // The 6th hit defeats it and the whole combat panel unmounts immediately,
  // so only rounds 1-5 have a combat-log left to check afterward.
  for (let round = 0; round < 6; round++) {
    await page.getByRole("button", { name: "Attack Fire-Demon" }).click();
    if (round < 5) {
      await expect(page.locator(".combat-log")).toContainText("You wound your foe!");
    }
  }

  await expect(page.locator(".combat-panel")).toHaveCount(0);
  await expect(page.locator(".stat-bar-strip")).toContainText("STAMINA24/24"); // player untouched

  await page.getByRole("button", { name: "Step past the smouldering embers toward the chamber beyond." }).click();
  await expect(page.getByText("Victory! Your adventure ends here.")).toBeVisible();
});
