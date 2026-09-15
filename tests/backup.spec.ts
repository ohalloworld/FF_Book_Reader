import { expect, test } from "@playwright/test";

test("export produces a backup that a later import fully restores", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "ff-reader:library:backup-test",
      JSON.stringify({ id: "backup-test", title: "Backup Test Book", ruleSetId: "standard-ff", startSection: "1" }),
    );
    localStorage.setItem("ff-reader:library:index", JSON.stringify(["backup-test"]));
  });
  await page.reload();
  await expect(page.locator(".library-card", { hasText: "Backup Test Book" })).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export backup" }).click()]);
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("ff-reader:"))
      .forEach((k) => localStorage.removeItem(k));
  });
  await page.reload();
  await expect(page.locator(".library-card", { hasText: "Backup Test Book" })).toHaveCount(0);

  await page.setInputFiles('input[type="file"][accept="application/json"]', backupPath!);
  await expect(page.getByText("Replace and restore")).toBeVisible();
  await page.getByRole("button", { name: "Replace and restore" }).click();

  await expect(page.locator(".library-card", { hasText: "Backup Test Book" })).toBeVisible({ timeout: 10_000 });
});
