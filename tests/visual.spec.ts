import { expect, test } from "@playwright/test";

test("контрольные снимки главного экрана", async ({ page }, testInfo) => {
  test.skip(!process.env.VISUAL_QA || testInfo.project.name !== "desktop", "Запускается отдельно для визуального QA");
  const viewports = [
    [1672, 941],
    [1366, 768],
    [1440, 810],
    [1920, 1080],
    [390, 844],
    [360, 800],
    [768, 1024],
  ] as const;

  for (const [width, height] of viewports) {
    const consoleErrors: string[] = [];
    const onConsole = (message: { type(): string; text(): string }) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    };
    page.on("console", onConsole);
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    if (width >= 1366) {
      const heroBox = await page.locator(".hero").boundingBox();
      expect(heroBox).not.toBeNull();
      expect(Math.ceil((heroBox?.y ?? 0) + (heroBox?.height ?? 0))).toBeLessThanOrEqual(height);
      await expect(page.locator(".hero-summary")).toBeInViewport();
      await expect(page.locator(".hero-trust")).toBeInViewport();
    }
    await page.screenshot({ path: `design-qa/screenshots/home-${width}x${height}.png`, animations: "disabled" });
    expect(consoleErrors).toEqual([]);
    page.off("console", onConsole);
  }
});
