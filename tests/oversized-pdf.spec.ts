import { expect, test } from "@playwright/test";

test("an oversized PDF is rejected locally, with no upload attempted", async ({ page }) => {
  let extractCalled = false;
  await page.route("**/api/extract-pdf-text", async (route) => {
    extractCalled = true;
    await route.continue();
  });

  await page.goto("/");
  await page
    .getByRole("button", { name: /Import Book Rules/i })
    .first()
    .click();
  await page.waitForSelector(".pdf-import");

  // A real 300MB+ file would blow the disk budget of a CI/sandbox run, so
  // build a tiny real File and spoof its reported .size -- the guard only
  // ever reads that property before doing anything else with the file.
  await page.evaluate(() => {
    const tinyBlob = new Blob(["%PDF-1.4 tiny"], { type: "application/pdf" });
    const file = new File([tinyBlob], "huge-scan.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 350 * 1024 * 1024 });
    const dt = new DataTransfer();
    dt.items.add(file);
    const input = document.querySelector(".pdf-import input[type=file]") as HTMLInputElement;
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await expect(page.locator(".luck-banner.failure")).toContainText("over the 300MB limit");
  expect(extractCalled).toBe(false);
});
