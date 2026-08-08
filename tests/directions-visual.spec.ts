import { expect, test } from "@playwright/test";

const routes = [
  ["marketing-i-privlechenie", "marketing"],
  ["sajt-crm-analitika", "digital"],
  ["kommercheskaya-sistema", "system"],
] as const;

test("контрольные снимки страниц направлений", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(
    !process.env.DIRECTION_QA || testInfo.project.name !== "desktop",
    "Запускается отдельно для визуального QA",
  );

  for (const [route, name] of routes) {
    for (const [width, height, label] of [
      [1440, 900, "desktop"],
      [1024, 900, "tablet-wide"],
      [768, 900, "tablet"],
      [390, 844, "mobile"],
      [320, 700, "mobile-small"],
    ] as const) {
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/${route}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
      const panelsFitViewport = await page.locator(".service-panel").evaluateAll(
        (panels) =>
          panels.every((panel) => {
            const rect = panel.getBoundingClientRect();
            return rect.left >= -1 && rect.right <= window.innerWidth + 1;
          }),
      );
      expect(panelsFitViewport).toBeTruthy();
      if (width <= 1024) {
        const toggles = page.locator(".service-panel h2 button");
        await expect(toggles.first()).toHaveAttribute("aria-expanded", "true");
        await expect(toggles.nth(1)).toHaveAttribute("aria-expanded", "false");
        await toggles.nth(1).click();
        await expect(toggles.nth(1)).toHaveAttribute("aria-expanded", "true");
        await toggles.first().click();
        await expect(toggles.first()).toHaveAttribute("aria-expanded", "false");
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `design-qa/screenshots/directions/${name}-${label}.png`,
        fullPage: true,
        animations: "disabled",
      });
      expect(consoleErrors).toEqual([]);
      page.removeAllListeners("console");
    }
  }
});
