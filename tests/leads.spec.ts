import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

const enabled = process.env.LEAD_API_QA === "1" && !!process.env.KVC_TEST_DB;
const routes = [
  "/",
  "/kontakty",
  "/kak-rabotaem",
  "/kejsy-i-razbory",
  "/dlya-klinik",
];

async function fill(page: Page, task: string) {
  const form = page.locator("[data-lead-form]");
  await form.getByLabel("Имя", { exact: true }).fill("Тестовый контакт");
  await form
    .getByLabel("Компания / клиника", { exact: true })
    .fill("Синтетическая клиника");
  await form
    .getByLabel("Телефон или мессенджер", { exact: true })
    .fill("+79990000000");
  await form.locator("textarea").fill(task);
  await form.getByRole("checkbox").check();
  return form;
}

function record(id: string) {
  return JSON.parse(
    execFileSync(
      "python3",
      [
        "-c",
        "import sqlite3,json,sys; c=sqlite3.connect(sys.argv[1]); r=c.execute('SELECT payload FROM leads WHERE id=?',(sys.argv[2],)).fetchone(); print(r[0] if r else 'null')",
        process.env.KVC_TEST_DB!,
        id,
      ],
      { encoding: "utf-8" },
    ),
  );
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    !enabled,
    "Requires isolated local SQLite/WSGI fixture; never send to production",
  );
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 844 });
  await page.setExtraHTTPHeaders({
    "X-KVC-Test-IP":
      testInfo.project.name === "mobile" ? "192.0.2.20" : "192.0.2.10",
  });
});

for (const route of routes) {
  test(`${route}: подтверждает сохранённую запись и источник`, async ({
    page,
  }, testInfo) => {
    await page.goto(route + "?utm_source=qa&utm_campaign=durability");
    const form = await fill(page, "Изолированная проверка страницы " + route);
    const response = page.waitForResponse(
      (r) => r.url().includes("/api/leads") && r.request().method() === "POST",
    );
    await form
      .getByRole("button", { name: "Получить предварительный разбор" })
      .click();
    const payload = await (await response).json();
    expect(payload.saved).toBe(true);
    await expect(form.getByRole("status")).toContainText("Заявка принята");
    await expect(form.getByRole("status")).toContainText(payload.id);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    if (route === "/kontakty")
      await form.screenshot({ path: testInfo.outputPath("saved-form.png") });
    const saved = record(payload.id);
    expect(saved.page).toBe(route);
    expect(saved.utm.utm_source).toBe("qa");
    expect(saved.consent).toBe(true);
  });
}

test("потерянный ответ: повтор сохраняет ID, а не вторую заявку", async ({
  page,
}) => {
  await page.goto("/kontakty");
  const form = await fill(page, "Изолированная потеря ответа");
  const ids: string[] = [];
  const requests: string[] = [];
  await page.route("**/api/leads", async (route) => {
    requests.push(route.request().postDataJSON().requestId);
    const result = await route.fetch();
    ids.push((await result.json()).id);
    if (ids.length === 1) await route.abort("failed");
    else await route.fulfill({ response: result });
  });
  await form
    .getByRole("button", { name: "Получить предварительный разбор" })
    .click();
  await expect(form.getByRole("alert")).toContainText("Не удалось подтвердить");
  await expect(form.getByLabel("Имя", { exact: true })).toHaveValue(
    "Тестовый контакт",
  );
  await form
    .getByRole("button", { name: "Получить предварительный разбор" })
    .click();
  await expect(form.getByRole("status")).toContainText("Заявка принята");
  expect(requests).toHaveLength(2);
  expect(requests[0]).toBe(requests[1]);
  expect(ids[0]).toBe(ids[1]);
  expect(record(ids[0])).toBeTruthy();
});

test("ответ без подтверждения сохранения и 503 не показывают успех", async ({
  page,
}) => {
  await page.goto("/kontakty");
  const form = await fill(page, "Изолированная ошибка сервера");
  await page.route("**/api/leads", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, id: "legacy-ack" }),
    }),
  );
  await form
    .getByRole("button", { name: "Получить предварительный разбор" })
    .click();
  await expect(form.getByRole("alert")).toBeVisible();
  await expect(form).not.toContainText("Заявка принята");
  await page.unroute("**/api/leads");
  await page.route("**/api/leads", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, saved: false }),
    }),
  );
  await form
    .getByRole("button", { name: "Получить предварительный разбор" })
    .click();
  await expect(form.getByRole("alert")).toBeVisible();
  await expect(form.getByLabel("Имя", { exact: true })).toHaveValue(
    "Тестовый контакт",
  );
});

test("двойное нажатие отправляет один запрос", async ({ page }) => {
  await page.goto("/kontakty");
  const form = await fill(page, "Изолированная проверка двойного нажатия");
  let count = 0;
  await page.route("**/api/leads", async (route) => {
    count++;
    await route.continue();
  });
  await form
    .getByRole("button", { name: "Получить предварительный разбор" })
    .click({ clickCount: 2 });
  await expect(form.getByRole("status")).toContainText("Заявка принята");
  expect(count).toBe(1);
});
