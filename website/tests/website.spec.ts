import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("hero, source links, metadata, and page navigation", async ({ page }) => {
  await expect(page).toHaveTitle("Vibes — Your Feed. Your Rules.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Scroll freely.Own theexperience.",
  );
  const github = page.getByRole("link", { name: "View on GitHub" });
  await expect(github).toHaveAttribute(
    "href",
    "https://github.com/axvrma/vibes",
  );
  await page.getByRole("link", { name: "See it in action" }).click();
  await expect(page).toHaveURL(/#experience$/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /og-image.png$/,
  );
  for (const link of await page.locator('a[href^="#"]').all()) {
    const id = await link.getAttribute("href");
    await expect(page.locator(id!)).toHaveCount(1);
  }
});

test("feed supports buttons, keyboard, selection, and like state per item", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Like video", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unlike video", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Next video", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Slow mornings, on repeat." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Like video", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  const feed = page.getByRole("region", {
    name: /Interactive sample video feed/,
  });
  await feed.focus();
  await page.keyboard.press("ArrowUp");
  await expect(
    page.getByRole("button", { name: "Unlike video", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Previous video", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Select Midnight Drive" }).click();
  await expect(
    page.getByRole("button", { name: "Next video", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Select Midnight Drive" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("notes save, reopen, and remain specific to the sample", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Add a personal note (concept preview)" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page
    .getByRole("textbox", { name: "Your personal note" })
    .fill("  Plan a quiet mountain weekend.  ");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Add a personal note (concept preview)" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Your personal note" }),
  ).toHaveValue("Plan a quiet mountain weekend.");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add a personal note (concept preview)" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Next video", exact: true }).click();
  await page
    .getByRole("button", { name: "Add a personal note (concept preview)" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Your personal note" }),
  ).toHaveValue("");
});

test("video plays, pauses, mutes, and replays through HTML5 APIs", async ({
  page,
}) => {
  const video = page.locator("video");
  await video.scrollIntoViewIfNeeded();
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState))
    .toBeGreaterThanOrEqual(2);
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => !el.paused))
    .toBe(true);
  await expect(video).toHaveJSProperty("muted", true);
  await page.getByRole("button", { name: "Unmute video", exact: true }).click();
  await expect(video).toHaveJSProperty("muted", false);
  await page.getByRole("button", { name: "Pause video", exact: true }).click();
  await expect(video).toHaveJSProperty("paused", true);
  await page.getByRole("button", { name: "Play video", exact: true }).click();
  await expect(video).toHaveJSProperty("paused", false);
  await video.evaluate((el: HTMLVideoElement) => {
    el.currentTime = 5;
  });
  await page.getByRole("button", { name: "Replay video", exact: true }).click();
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeLessThan(2);
  await expect(page.locator("video")).toHaveCount(1);
});

test("only active video loads, offscreen playback stops, and errors preserve navigation", async ({
  page,
}) => {
  const video = page.locator("video");
  await video.scrollIntoViewIfNeeded();
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => !el.paused))
    .toBe(true);
  await page.locator("#self-hosting").scrollIntoViewIfNeeded();
  await expect(video).toHaveJSProperty("paused", true);
  await page.route("**/media/coffee.mp4", (route) => route.abort());
  await page.getByRole("button", { name: "Next video", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Preview unavailable." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next video", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A different point of view." }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(1);
});

test("dashboard sample filters and search are functional", async ({ page }) => {
  await page.getByRole("button", { name: "Nature", exact: true }).click();
  await expect(page.locator(".dashboard-media-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Everyday", exact: true }).click();
  await expect(page.locator(".dashboard-media-card")).toHaveCount(1);
  await expect(page.locator(".dashboard-media-card")).toContainText(
    "Morning Ritual",
  );
  await page
    .getByRole("searchbox", { name: "Search sample library" })
    .fill("nothing here");
  await expect(page.getByText("No sample videos match.")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search sample library" }).clear();
  await page.getByRole("button", { name: /All media/ }).click();
  await expect(page.locator(".dashboard-media-card")).toHaveCount(5);
  await page
    .locator(".dashboard-media-card")
    .filter({ hasText: "Ocean Hours" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Meet me where it’s quiet." }),
  ).toBeVisible();
});

test("copy control copies exact Docker commands", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy deployment commands" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(
      "git clone https://github.com/axvrma/vibes.git\ncd vibes/infra\ntest -f .env || cp .env.example .env\n${EDITOR:-vi} .env\ndocker compose config -q && docker compose up -d --build",
    );
});

test("mobile menu is keyboard accessible and closes on Escape and selection", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile navigation is hidden on desktop");
  const toggle = page.getByRole("button", { name: "Open menu", exact: true });
  await toggle.click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Features" })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).not.toBeVisible();
  await expect(page).toHaveURL(/#features$/);
});

test("wheel navigates without cancelling the page scroll event", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Wheel input applies to desktop");
  const wasNotCancelled = await page
    .getByRole("region", { name: /Interactive sample video feed/ })
    .evaluate((el) =>
      el.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: 100,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
  expect(wasNotCancelled).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Slow mornings, on repeat." }),
  ).toBeVisible();
});

test("touch swipe navigates without preventing normal touch scrolling", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Touch input applies to mobile");
  await page
    .getByRole("region", { name: /Interactive sample video feed/ })
    .evaluate((el) => {
      const start = new Touch({
        identifier: 1,
        target: el,
        clientX: 150,
        clientY: 400,
      });
      const end = new Touch({
        identifier: 1,
        target: el,
        clientX: 150,
        clientY: 220,
      });
      el.dispatchEvent(
        new TouchEvent("touchstart", { touches: [start], bubbles: true }),
      );
      el.dispatchEvent(
        new TouchEvent("touchend", { changedTouches: [end], bubbles: true }),
      );
    });
  await expect(
    page.getByRole("heading", { name: "Slow mornings, on repeat." }),
  ).toBeVisible();
});

test("no horizontal overflow at supported widths or uncaught browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.reload();
  for (const width of [320, 375, 650, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 950 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
  expect(errors).toEqual([]);
});

test("reduced motion keeps video paused until visitor chooses play", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("video")).toHaveJSProperty("paused", true);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Play video", exact: true }).click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((el: HTMLVideoElement) => !el.paused),
    )
    .toBe(true);
});

test("page and note dialog pass automated WCAG AA checks", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Let the short cinematic entrance finish so contrast is measured at its final opacity.
  await page.waitForTimeout(1100);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Add a personal note (concept preview)" })
    .click();
  await page
    .getByRole("dialog")
    .evaluate((element) =>
      Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      ),
    );
  const dialog = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(dialog.violations).toEqual([]);
});
