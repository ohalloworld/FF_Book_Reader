import { expect, test } from "@playwright/test";

test("a transcribed page is cached and never re-sent to Claude on a later visit", async ({ page }) => {
  let transcribeCalls = 0;
  await page.route("**/api/library/**/pdf-status", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ exists: true, totalPages: 5 }) }),
  );
  await page.route("**/api/library/**/transcribe-page", async (route, req) => {
    transcribeCalls++;
    const body = JSON.parse(req.postData() || "{}") as { page: number };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        pdfPage: body.page,
        paragraphs: [{ id: String(body.page), text: `Text for page ${body.page}`, choices: [] }],
        imageDataUrl: null,
      }),
    });
  });

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "ff-reader:library:cache-test",
      JSON.stringify({ id: "cache-test", title: "Cache Test Book", ruleSetId: "standard-ff", startSection: "1" }),
    );
    localStorage.setItem("ff-reader:library:index", JSON.stringify(["cache-test"]));
  });
  await page.reload();

  const card = page.locator(".library-card", { hasText: "Cache Test Book" });
  await card.getByRole("button", { name: /^Play$/ }).click();
  await page.locator("#hero-name").fill("Reader");
  await page.getByRole("button", { name: "Begin a new adventure" }).click();
  await page.getByRole("heading", { name: "Roll your Adventure Sheet" }).waitFor();
  await page.getByRole("button", { name: "Begin the adventure" }).click();

  // Section 1 has no transcription yet -> blank-section prompt.
  await page.locator('input[placeholder="PDF page number"]').fill("1");
  await page.getByRole("button", { name: "Transcribe this page" }).click();
  await expect(page.locator(".section-text")).toContainText("Text for page 1");
  expect(transcribeCalls).toBe(1);

  // Leave and come back to the same section via Resume — the cached text
  // should appear immediately, with no second API call and no prompt.
  await page.getByRole("button", { name: "← Back to Library" }).click();
  await card.getByRole("button", { name: /^Play$/ }).click();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await expect(page.locator(".section-text")).toContainText("Text for page 1");
  await expect(page.getByRole("button", { name: "Transcribe this page" })).toHaveCount(0);
  expect(transcribeCalls).toBe(1);
});
