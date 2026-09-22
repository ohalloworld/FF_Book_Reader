import { expect, test } from "@playwright/test";
import { stubMaxDice } from "./helpers";

const MOCK_RULESET = {
  bookTitle: "Wizardry Test Book",
  stats: [
    { key: "skill", label: "SKILL", kind: "pool", generation: "1D6+6" },
    { key: "stamina", label: "STAMINA", kind: "pool", generation: "2D6+12" },
    { key: "luck", label: "LUCK", kind: "pool", generation: "1D6+12" },
    { key: "magic_points", label: "Magic Points", kind: "pool", generation: "20", group: "Magic" },
  ],
  tests: [{ key: "luck", label: "Test your Luck", statKey: "luck", rollFormula: "2D6", successWhen: "lte", decrementStatOnUse: 1 }],
  combat: { rollFormula: "2D6", attackStat: "skill", damageStat: "stamina", damagePerHit: 2 },
  abilities: [
    {
      key: "fireball",
      label: "Fireball",
      description: "Hurls a ball of fire at one enemy.",
      group: "Magic",
      costStatKey: "magic_points",
      costAmount: 8,
    },
  ],
  specialRules: [],
};

test("an imported rule set's grouped stats and costed abilities work end-to-end during play", async ({ page }) => {
  await stubMaxDice(page);

  await page.route("**/api/parse-rules", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ruleSet: MOCK_RULESET }) }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Import Book Rules" }).click();
  await page.locator(".rules-textarea").fill("SKILL: 1D6+6. Magic Points: 20, used to cast spells like Fireball (8 points).");
  await page.getByRole("button", { name: "Parse Rules" }).click();

  // The draft preview (RuleSetSummary) shows the grouped stat and the
  // ability with its cost -- confirming the extraction data actually
  // surfaces here, not just silently in the saved object.
  await expect(page.locator(".draft-panel")).toContainText("Magic");
  await expect(page.locator(".draft-panel")).toContainText("Fireball");
  await expect(page.locator(".draft-panel")).toContainText("costs 8 Magic Points");

  await page.getByRole("button", { name: "Save this rule set" }).click();

  await page.getByRole("button", { name: "Library" }).click();
  await page.locator('form.library-create-form input[type="text"]').first().fill("Wizard Adventure");
  await page.locator('form.library-create-form select').selectOption({ label: "Wizardry Test Book" });
  await page.getByRole("button", { name: "Add Book" }).click();

  const card = page.locator(".library-card", { hasText: "Wizard Adventure" });
  await card.getByRole("button", { name: /^Play$/ }).click();
  await page.locator("#hero-name").fill("Merlin");
  await page.getByRole("button", { name: "Begin a new adventure" }).click();
  await page.getByRole("heading", { name: "Roll your Adventure Sheet" }).waitFor();
  await page.getByRole("button", { name: "Begin the adventure" }).click();

  // Open the character sheet drawer and confirm the "Magic" group and its
  // Fireball ability render, with a working Use button that deducts the
  // right stat by the right amount.
  await page.getByRole("button", { name: /Merlin/ }).click();
  await page.waitForSelector(".character-sheet");

  await expect(page.locator(".character-sheet")).toContainText("Magic");
  const magicPointsStat = page.locator(".stat", { hasText: "Magic Points" });
  await expect(magicPointsStat.locator(".stat-value")).toHaveText("20 / 20");

  const fireball = page.locator(".ability-item", { hasText: "Fireball" });
  await expect(fireball).toContainText("8 Magic Points");
  await fireball.getByRole("button", { name: "Use" }).click();

  await expect(magicPointsStat.locator(".stat-value")).toHaveText("12 / 20");

  // Cast twice more -- 12 - 8 = 4, not enough for an 8-point spell -- the
  // Use button should now be disabled rather than letting it go negative.
  await fireball.getByRole("button", { name: "Use" }).click();
  await expect(magicPointsStat.locator(".stat-value")).toHaveText("4 / 20");
  await expect(fireball.getByRole("button", { name: "Use" })).toBeDisabled();
});
