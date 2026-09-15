import type { Page } from "@playwright/test";

/** Stubs Math.random to always max out every die roll (6 on a d6, 12 on
 * 2D6) — makes combat, tests, and stat generation fully deterministic for
 * tests that need a predictable outcome, without touching engine code. */
export async function stubMaxDice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
}

/** Plays through the built-in demo book's title screen and character
 * roll to the first section, for tests that just need a started game. */
export async function beginDemoAdventure(page: Page, name = "Tester"): Promise<void> {
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Play$/ })
    .first()
    .click();
  await page.locator("#hero-name").fill(name);
  await page.getByRole("button", { name: "Begin a new adventure" }).click();
  await page.getByRole("heading", { name: "Roll your Adventure Sheet" }).waitFor();
  await page.getByRole("button", { name: "Begin the adventure" }).click();
}
