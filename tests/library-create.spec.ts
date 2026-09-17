import { expect, test } from "@playwright/test";

test("adding a book saves it immediately and hands off PDF attachment as a separate step", async ({ page }) => {
  await page.route("**/api/library/**/pdf-status", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ exists: false }) }),
  );
  let pdfUploaded = false;
  await page.route("**/api/library/**/pdf", async (route) => {
    pdfUploaded = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/");
  await page.locator('form.library-create-form input[type="text"]').first().fill("New Test Book");
  await page.getByRole("button", { name: "Add Book" }).click();

  // The book is saved right away -- no PDF needed up front -- and its
  // Manage panel opens automatically with "Attach PDF" ready to go, so a
  // slow/large file picker interaction never risks losing the title/author/
  // rule-set fields the way sharing one form submission would.
  const card = page.locator(".library-card", { hasText: "New Test Book" });
  await expect(card).toBeVisible();
  await expect(card.getByText("Attach PDF")).toBeVisible();

  // The create form itself is already reset and ready for the next book.
  await expect(page.locator('form.library-create-form input[type="text"]').first()).toHaveValue("");

  await card.locator('input[type="file"]').setInputFiles({
    name: "book.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 fake"),
  });
  await expect.poll(() => pdfUploaded).toBe(true);
});
