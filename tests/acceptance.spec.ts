import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const paths = [
  "/",
  "/marketing-i-privlechenie",
  "/sajt-crm-analitika",
  "/kommercheskaya-sistema",
  "/kak-rabotaem",
  "/kejsy-i-razbory",
  "/dlya-klinik",
  "/kontakty",
  "/soglasheniya",
];
for (const width of [320, 360, 390, 430, 1280, 1440]) {
  test(`all pages fit ${width}px and have one main landmark`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "The matrix uses explicit viewports",
    );
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of paths) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, `${path} at ${width}`).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: info.outputPath(
          `${width}-${path.replaceAll("/", "") || "home"}.png`,
        ),
      });
    }
  });
}

test("menu Escape, FAQ regions and process anchor work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Открыть меню" });
  await toggle.click();
  await expect(
    page.getByRole("navigation", { name: "Мобильная навигация" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Закрыть меню" }).press("Escape");
  await expect(
    page.getByRole("navigation", { name: "Мобильная навигация" }),
  ).toBeHidden();
  await expect(toggle).toBeFocused();
  const question = page.getByRole("button", {
    name: "Вы можете разработать CRM специально для нашей клиники?",
    exact: true,
  });
  await question.click();
  const panel = page.getByRole("region", {
    name: "Вы можете разработать CRM специально для нашей клиники?",
    exact: true,
  });
  await expect(panel).toBeVisible();
  await question.click();
  await expect(panel).toBeHidden();
  await page.goto("/kak-rabotaem");
  await page
    .getByRole("link", { name: "Как начинаем", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/#etapy$/);
  const top = await page
    .locator("#etapy")
    .evaluate((e) => e.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(70);
});

test("CRM interest follows the shared durable form", async ({ page }) => {
  test.skip(process.env.LEAD_API_QA !== "1", "Isolated API required");
  await page.setExtraHTTPHeaders({ "X-KVC-Test-IP": "192.0.2.111" });
  await page.goto("/sajt-crm-analitika");
  await page
    .getByRole("link", { name: "Обсудить CRM-задачу", exact: true })
    .click();
  await expect(page).toHaveURL(/interest=crm_custom#forma$/);
  const form = page.locator("[data-lead-form]");
  await form.getByLabel("Имя", { exact: true }).fill("Тест CRM");
  await form
    .getByLabel("Компания / клиника", { exact: true })
    .fill("Синтетическая клиника");
  await form
    .getByLabel("Телефон или мессенджер", { exact: true })
    .fill("+79990000111");
  await form.getByRole("checkbox").check();
  const saved = page.waitForResponse(
    (r) => r.url().includes("/api/leads") && r.request().method() === "POST",
  );
  await form
    .getByRole("button", { name: "Получить предварительный разбор" })
    .click();
  const response = await saved;
  expect(response.request().postDataJSON().interest).toBe("crm_custom");
  expect((await response.json()).saved).toBe(true);
  await expect(form.getByRole("status")).toContainText("Заявка принята");
});

test("native form uses POST without JavaScript and never puts contact in URL", async ({
  browser,
}) => {
  test.skip(process.env.LEAD_API_QA !== "1", "Isolated API required");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    // Keep this native HTML test independent of scroll/animation timing.
    reducedMotion: "reduce",
    extraHTTPHeaders: { "X-KVC-Test-IP": "192.0.2.112" },
  });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3000/kontakty");
    const form = page.locator("[data-lead-form]");
    await expect(form).toHaveAttribute("method", "post");
    await expect(form).toHaveAttribute("action", "/api/leads");
    await form.getByLabel("Имя", { exact: true }).fill("Синтетический тест");
    await form
      .getByLabel("Компания / клиника", { exact: true })
      .fill("Тестовая клиника");
    await form
      .getByLabel("Телефон или мессенджер", { exact: true })
      .fill("+79990000112");
    await form.getByRole("checkbox").check();
    await form
      .getByRole("button", { name: "Получить предварительный разбор" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Заявка принята", exact: true }),
    ).toBeVisible();
    expect(page.url()).toBe("http://127.0.0.1:3000/api/leads");
    await expect(page.locator("body")).not.toContainText("+79990000112");
  } finally {
    await context.close();
  }
});

test("main content, CRM and contacts have no serious automated accessibility violations", async ({
  page,
}, info) => {
  test.skip(
    process.env.ACCESSIBILITY_QA !== "1",
    "Run explicitly with the isolated acceptance suite",
  );
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const failures: unknown[] = [];
  for (const route of paths) {
    await page.goto(route);
    await page.locator("h1").waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    await info.attach(route.replaceAll("/", "") || "home", {
      body: JSON.stringify(results.violations, null, 2),
      contentType: "application/json",
    });
    failures.push(
      ...results.violations
        .filter((v) => ["serious", "critical"].includes(v.impact || ""))
        .map((v) => ({
          route,
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            reason: n.failureSummary,
          })),
        })),
    );
  }
  expect(failures).toEqual([]);
});
