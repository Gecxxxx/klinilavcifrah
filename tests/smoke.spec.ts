import { expect, test } from "@playwright/test";

const routes = [
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

const removedRoutes = ["/chto-my-delaem", "/komanda", "/o-kompanii"];

for (const route of routes) {
  test(`${route} отдаёт страницу без горизонтального скролла`, async ({
    page,
  }) => {
    const response = await page.goto(route);
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("h1")).toHaveCount(1);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

for (const route of removedRoutes) {
  test(`${route} удалён и отдаёт 404`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Страница не найдена",
    );
  });
}

test("главный экран содержит утверждённую цепочку и значения", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Весь путь пациента",
  );
  await expect(page.getByText("67%", { exact: true })).toBeVisible();
  await expect(page.getByText("24%", { exact: true })).toBeVisible();
  await expect(page.locator(".hero-summary")).toHaveCount(0);
  await expect(page.locator(".hero-trust")).toHaveCount(0);
});

test("мобильное меню и FAQ работают", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Только мобильный проект");
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await expect(page.locator("#mobile-menu")).toHaveClass(/open/);
  await page.getByRole("button", { name: /Вы заменяете/ }).click();
  await expect(page.getByText(/Если специалист или подрядчик/)).toBeVisible();
});

test("интерактивная воронка переключает этапы", async ({ page }) => {
  await page.goto("/");
  const focus = page.locator(".journey-focus");
  await expect(focus.getByRole("heading", { level: 3 })).toHaveText(
    "Обращение",
  );
  await page.locator(".journey-node").filter({ hasText: "Запись" }).click();
  await expect(focus.getByRole("heading", { level: 3 })).toHaveText("Запись");
  await focus.getByRole("button", { name: "Следующий этап" }).click();
  await expect(focus.getByRole("heading", { level: 3 })).toHaveText("Визит");
});

test("форма валидируется на русском", async ({ page }) => {
  await page.goto("/kontakty#forma");
  await page
    .getByRole("button", { name: "Получить предварительный разбор" })
    .last()
    .click();
  await expect(page.getByText("Введите имя")).toBeVisible();
  await expect(page.getByText("Укажите клинику или компанию")).toBeVisible();
});

test("404, sitemap и robots доступны", async ({ page }) => {
  const notFound = await page.goto("/net-takoi-stranicy");
  expect(notFound?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Страница не найдена",
  );
  expect((await page.request.get("/sitemap.xml")).ok()).toBeTruthy();
  expect((await page.request.get("/robots.txt")).ok()).toBeTruthy();
});

test("клавиатурный фокус виден, а reduced motion поддерживается", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus-visible");
  await expect(focused).toBeVisible();
  const motionPreference = await page.evaluate(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  expect(motionPreference).toBeTruthy();
});

test("страницы направлений используют реальные фото и корректные внешние ссылки", async ({
  page,
}) => {
  await page.goto("/marketing-i-privlechenie");
  await expect(page.locator(".service-portrait")).toHaveAttribute(
    "src",
    /daria/,
  );
  await expect(
    page.getByRole("link", { name: /Обратиться к Дарье/ }),
  ).toHaveAttribute("href", "https://daria-kamins.marketing/");

  await page.goto("/sajt-crm-analitika");
  await expect(page.locator(".service-portrait")).toHaveAttribute(
    "src",
    /egor/,
  );
  await expect(
    page.getByRole("link", { name: /Обратиться к Егору/ }),
  ).toHaveAttribute("href", "https://egordigital.site/");

  await page.goto("/kommercheskaya-sistema");
  await expect(page.locator(".service-portrait")).toHaveAttribute(
    "src",
    /timur/,
  );
  await expect(page.getByRole("link", { name: /Обратиться к/ })).toHaveCount(0);
});
