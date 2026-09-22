import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const TOTAL_PAGES = 4;
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

/** Registers mocked /api/library/<bookId>/* routes on a page that all read
 * from one shared `getDone()` closure -- standing in for the dev server's
 * own in-memory job state, which really does keep advancing independent
 * of any particular browser tab. Used on more than one Playwright page in
 * this file, on purpose: that's the whole point being tested -- a second,
 * brand-new page asking these same "server" routes sees whatever the
 * first page's job already got done, with no memory of its own. */
async function mockLibraryRoutes(page: Page, bookId: string, getDone: () => number, jobState: { started: boolean }) {
  await page.route(`**/api/library/${bookId}/pdf-status`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ exists: true, totalPages: TOTAL_PAGES }) }),
  );
  await page.route(`**/api/library/${bookId}/bulk-transcribe-status`, (route) => {
    if (!jobState.started) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "idle", total: 0, done: 0, currentPage: null, failedPages: [] }),
      });
      return;
    }
    const done = getDone();
    const status = done >= TOTAL_PAGES ? "done" : "running";
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status, total: TOTAL_PAGES, done, currentPage: done < TOTAL_PAGES ? done + 1 : null, failedPages: [] }),
    });
  });
  await page.route(`**/api/library/${bookId}/bulk-transcribe`, (route) => {
    jobState.started = true;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route(`**/api/library/${bookId}/pages`, (route) => {
    const done = getDone();
    const pages: Record<number, unknown> = {};
    for (let p = 1; p <= done; p++) pages[p] = { pdfPage: p, paragraphs: [{ id: String(p), text: `Text for server page ${p}`, choices: [] }] };
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ pages }) });
  });
  await page.route(`**/api/library/${bookId}/page-image/*`, (route) => {
    const requestedPage = Number(new URL(route.request().url()).pathname.split("/").pop());
    if (requestedPage > getDone()) {
      route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "no image" }) });
      return;
    }
    route.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG });
  });
}

test("a bulk-transcribe job's progress survives closing the tab entirely, and a fresh tab picks it up", async ({ browser }) => {
  const bookId = "bg-transcribe-test";

  // Stands in for the dev server's own job loop -- advances on its own
  // timer, with no page open at all in between increments, exactly like
  // the real server keeps working through pages independent of any
  // browser tab.
  let serverDone = 0;
  const jobState = { started: false };
  const advance = setInterval(() => {
    if (jobState.started && serverDone < TOTAL_PAGES) serverDone++;
  }, 900);

  try {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await mockLibraryRoutes(pageA, bookId, () => serverDone, jobState);

    await pageA.goto("/");
    await pageA.evaluate((id) => {
      localStorage.setItem(
        `ff-reader:library:${id}`,
        JSON.stringify({ id, title: "Background Test Book", ruleSetId: "standard-ff", startSection: "1" }),
      );
      localStorage.setItem("ff-reader:library:index", JSON.stringify([id]));
    }, bookId);
    await pageA.reload();

    const card = pageA.locator(".library-card", { hasText: "Background Test Book" });
    await card.getByRole("button", { name: "Manage" }).click();
    await expect(card.getByText("Pre-transcribe entire book")).toBeVisible();

    await card.getByText("Pre-transcribe entire book").click();
    // Wait for at least one poll to show real progress from the "server".
    await expect(card.getByText(/Transcribing page/)).toBeVisible({ timeout: 6000 });

    // Close this tab (and its whole context) entirely -- the equivalent
    // of locking the phone or swiping the app away. No page is open, no
    // JS is running for this app anywhere, for the next couple of
    // seconds -- but `advance` above keeps ticking regardless, standing
    // in for the real server continuing on its own.
    await pageA.close();
    await contextA.close();

    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(serverDone).toBeGreaterThan(0);
    const doneWhileClosed = serverDone;

    // A brand-new tab, with no memory of ever starting this job, opens
    // the same book -- and should immediately show whatever the "server"
    // already finished while nothing was open, synced down as real pages.
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await mockLibraryRoutes(pageB, bookId, () => serverDone, jobState);

    await pageB.goto("/");
    await pageB.evaluate((id) => {
      localStorage.setItem(
        `ff-reader:library:${id}`,
        JSON.stringify({ id, title: "Background Test Book", ruleSetId: "standard-ff", startSection: "1" }),
      );
      localStorage.setItem("ff-reader:library:index", JSON.stringify([id]));
    }, bookId);
    await pageB.reload();

    const cardB = pageB.locator(".library-card", { hasText: "Background Test Book" });
    await cardB.getByRole("button", { name: "Manage" }).click();
    await expect(cardB.getByText(/Transcribing page|All \d+ pages transcribed/)).toBeVisible({ timeout: 6000 });

    await expect
      .poll(
        async () => {
          const text = await cardB.getByText(new RegExp(`Show page map \\((\\d+)/${TOTAL_PAGES}\\)`)).textContent();
          return Number(text?.match(/\((\d+)\//)?.[1] ?? 0);
        },
        { timeout: 10000 },
      )
      .toBeGreaterThanOrEqual(doneWhileClosed);

    // And the synced pages are real, readable transcriptions, not just a
    // count -- pulled from the mocked /pages + /page-image endpoints into
    // this fresh tab's own localStorage/IndexedDB, per pageSync.ts.
    const stored = await pageB.evaluate((id) => localStorage.getItem(`ff-reader:book-pages:${id}`), bookId);
    expect(stored).toContain("Text for server page 1");

    await pageB.close();
    await contextB.close();
  } finally {
    clearInterval(advance);
  }
});
