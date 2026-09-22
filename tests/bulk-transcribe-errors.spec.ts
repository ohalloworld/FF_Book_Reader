import { expect, test } from "@playwright/test";

const TOTAL_PAGES = 3;

test("a bulk-transcribe job's real per-page error surfaces in the UI, not just a page number", async ({ page }) => {
  let pollCount = 0;

  await page.route("**/api/library/**/pdf-status", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ exists: true, totalPages: TOTAL_PAGES }) }),
  );
  await page.route("**/api/library/**/pages", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ pages: {} }) }),
  );
  await page.route("**/api/library/**/bulk-transcribe", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
  );
  await page.route("**/api/library/**/bulk-transcribe-status", (route) => {
    pollCount++;
    // First poll: still working. From then on: done, with one page having
    // failed for a specific, real reason -- not just swallowed.
    if (pollCount === 1) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "running", total: TOTAL_PAGES, done: 2, currentPage: 3, failedPages: [] }),
      });
      return;
    }
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "done",
        total: TOTAL_PAGES,
        done: 2,
        currentPage: null,
        failedPages: [{ page: 3, error: "Claude did not return a parseable transcription. Try again." }],
      }),
    });
  });

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "ff-reader:library:error-test",
      JSON.stringify({ id: "error-test", title: "Error Test Book", ruleSetId: "standard-ff", startSection: "1" }),
    );
    localStorage.setItem("ff-reader:library:index", JSON.stringify(["error-test"]));
  });
  await page.reload();

  const card = page.locator(".library-card", { hasText: "Error Test Book" });
  await card.getByRole("button", { name: "Manage" }).click();
  await card.getByText("Pre-transcribe entire book").click();

  // The real error text shows, per failed page -- not just "page 3 failed".
  await expect(card.getByText("Page 3: Claude did not return a parseable transcription. Try again.")).toBeVisible({
    timeout: 8000,
  });
});
