import { expect, test } from "@playwright/test";
import { beginDemoAdventure } from "./helpers";

test("resume restores position; starting over requires confirmation", async ({ page }) => {
  await beginDemoAdventure(page);
  await page.getByRole("button", { name: "Push the door open and enter." }).click();
  await expect(page.locator(".section-number")).toHaveText("2");

  await page.getByRole("button", { name: "← Back to Library" }).click();
  const demoCard = page.locator(".library-card", { hasText: "The Crypt of Embers" });
  await demoCard.getByRole("button", { name: /^Play$/ }).click();
  await expect(page.getByRole("button", { name: "Resume saved game" })).toBeVisible();

  await page.getByRole("button", { name: "Resume saved game" }).click();
  await expect(page.locator(".section-number")).toHaveText("2");

  // Overwrite confirmation: cancelling leaves the save intact.
  await page.getByRole("button", { name: "← Back to Library" }).click();
  await demoCard.getByRole("button", { name: /^Play$/ }).click();
  await page.getByRole("button", { name: "Begin a new adventure" }).click();
  await expect(page.getByText("deletes your saved game")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Resume saved game" })).toBeVisible();

  // Confirming starts a genuinely fresh game.
  await page.getByRole("button", { name: "Begin a new adventure" }).click();
  await page.getByRole("button", { name: "Yes, start over" }).click();
  await page.getByRole("heading", { name: "Roll your Adventure Sheet" }).waitFor();
  await page.getByRole("button", { name: "Begin the adventure" }).click();
  await expect(page.locator(".section-number")).toHaveText("1");
});
