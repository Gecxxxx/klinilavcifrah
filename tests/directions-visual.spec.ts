import { expect, test } from "@playwright/test";

const routes = [
  ["marketing-i-privlechenie", "marketing"],
  ["sajt-crm-analitika", "digital"],
  ["kommercheskaya-sistema", "system"],
] as const;

test("контрольные снимки страниц направлений", async ({ page }, testInfo) => {
  test.skip(
    !process.env.DIRECTION_QA || testInfo.project.name !== "desktop",
    "Запускается отдельно для визуального QA",
  );

  for (const [route, name] of routes) {
    for (const [width, height, label] of [
      [1440, 900, "desktop"],
      [945, 844, "mobile-wide"],
      [390, 844, "mobile"],
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
