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
  await page.addInitScript(() => {
    const events: unknown[] = [];
    Object.assign(window, { kvcGoals: events });
    window.addEventListener("kvc:goal", (event) =>
      events.push((event as CustomEvent).detail),
    );
  });
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
    if (route !== "/kontakty") {
      await page.locator('.final-cta a[href="/kontakty#forma"]').click();
    }
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
    expect(
      await form.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left >= -1 &&
          box.right <= document.documentElement.clientWidth + 1
        );
      }),
    ).toBe(true);
    if (route === "/kontakty")
      await form.screenshot({ path: testInfo.outputPath("saved-form.png") });
    const saved = record(payload.id);
    expect(saved.page).toBe("/kontakty");
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
  expect(
    (await goals(page)).filter((x) => x.goal === "lead_saved"),
  ).toHaveLength(1);
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

async function goals(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          kvcGoals: { goal: string; params: Record<string, string> }[];
        }
      ).kvcGoals,
  );
}

test("invalid contact stays local, focuses the field and reports a validation reason", async ({
  page,
}) => {
  await page.goto("/kontakty");
  const form = await fill(page, "Local validation only");
  let posts = 0;
  await page.route("**/api/leads", (route) => {
    posts++;
    return route.abort();
  });
  const phone = form.getByLabel("Телефон или мессенджер", { exact: true });
  await phone.fill("abcdef");
  await form
    .getByRole("button", { name: "Получить предварительный разбор" })
    .click();
  await expect(phone).toBeFocused();
  await expect(phone).toHaveAttribute("aria-invalid", "true");
  const described = await phone.getAttribute("aria-describedby");
  expect(described).toContain("-error");
  await expect(
    form.getByText("Укажите телефон, email или Telegram-контакт"),
  ).toBeVisible();
  expect(posts).toBe(0);
  const events = await goals(page);
  expect(
    events.filter((x) => x.goal === "form_error").at(-1)?.params.reason,
  ).toBe("validation");
  expect(
    events.some((x) => x.goal === "form_submit" || x.goal === "lead_saved"),
  ).toBe(false);
});

test("campaign and service CTA survive navigation and reload and reach the registry", async ({
  page,
}) => {
  const clicked: { goal: string }[] = [];
  await page.exposeFunction("qaCaptureGoal", (value: { goal: string }) =>
    clicked.push(value),
  );
  await page.addInitScript(() =>
    window.addEventListener("kvc:goal", (event) => {
      void (
        window as unknown as { qaCaptureGoal(value: unknown): Promise<void> }
      ).qaCaptureGoal((event as CustomEvent).detail);
    }),
  );
  await page.goto(
    "/sajt-crm-analitika?utm_source=qr&utm_medium=print&utm_campaign=autumn",
    { referer: "https://partner.test/article?contact=private" },
  );
  await page.locator('.service-hero [data-lead-cta="service_hero"]').click();
  await expect(page).toHaveURL(/kontakty/);
  await expect
    .poll(() => clicked.filter((x) => x.goal === "cta_click").length)
    .toBe(1);
  await page.reload();
  const form = await fill(page, "Service attribution QA");
  const response = page.waitForResponse(
    (r) => r.url().includes("/api/leads") && r.request().method() === "POST",
  );
  await form
    .getByRole("button", { name: "Получить предварительный разбор" })
    .click();
  const accepted = await (await response).json();
  expect(accepted.saved).toBe(true);
  const saved = record(accepted.id);
  expect(saved.landingPage).toBe("/sajt-crm-analitika");
  expect(saved.referrer).toBe("https://partner.test/article");
  expect(saved.utm.utm_source).toBe("qr");
  expect(saved.direction).toBe("digital");
  expect(saved.product).toBe("preliminary_review");
  expect(saved.ctaLocation).toBe("service_hero");
  expect(saved.ctaPage).toBe("/sajt-crm-analitika");
  await expect(form.getByRole("status")).toBeFocused();
  const events = await goals(page);
  expect(events.filter((x) => x.goal === "lead_saved")).toHaveLength(1);
  expect(JSON.stringify(events)).not.toContain("+79990000000");
  expect(JSON.stringify(events)).not.toContain("Service attribution QA");
});

test("blocked storage still submits the current campaign", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new Error("Storage disabled");
      },
    }),
  );
  await page.goto(
    "/kontakty?utm_source=telegram&utm_campaign=storage_disabled",
  );
  const form = await fill(page, "Blocked storage QA");
  const response = page.waitForResponse(
    (r) => r.url().includes("/api/leads") && r.request().method() === "POST",
  );
  await form
    .getByRole("button", { name: "Получить предварительный разбор" })
    .click();
  const accepted = await (await response).json();
  expect(accepted.saved).toBe(true);
  expect(record(accepted.id).utm.utm_source).toBe("telegram");
  await expect(form.getByRole("status")).toContainText("Заявка принята");
});

test("rate limit keeps values and request ID; analytics failure cannot turn a saved lead into an error", async ({
  page,
}) => {
  await page.goto("/kontakty");
  const form = await fill(page, "Simulated rate limit QA");
  const ids: string[] = [];
  await page.route("**/api/leads", async (route) => {
    ids.push(route.request().postDataJSON().requestId);
    await route.fulfill({
      status: ids.length === 1 ? 429 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        ids.length === 1
          ? {
              ok: false,
              saved: false,
              message: "Слишком много попыток. Попробуйте через минуту.",
            }
          : {
              ok: true,
              saved: true,
              id: "12345678-1234-1234-1234-123456789abc",
            },
      ),
    });
  });
  await form
    .getByRole("button", { name: "Получить предварительный разбор" })
    .click();
  await expect(form.getByRole("alert")).toBeFocused();
  await expect(form.getByLabel("Имя", { exact: true })).toHaveValue(
    "Тестовый контакт",
  );
  expect(
    (await goals(page)).findLast((x) => x.goal === "form_error")?.params.reason,
  ).toBe("rate_limit");
  await page.evaluate(() => {
    const dispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = (event: Event) => {
      if (event.type === "kvc:goal") throw new Error("Blocked analytics");
      return dispatch(event);
    };
    Object.assign(window, {
      ym: () => {
        throw new Error("Blocked metrika");
      },
    });
  });
  await form
    .getByRole("button", { name: "Получить предварительный разбор" })
    .click();
  await expect(form.getByRole("status")).toContainText("Заявка принята");
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
});

test("fields stay locked until the outstanding request finishes", async ({
  page,
}) => {
  await page.goto("/kontakty");
  const form = await fill(page, "Isolated locked controls QA");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/leads", async (route) => {
    await gate;
    await route.continue();
  });
  const name = form.getByLabel("Имя", { exact: true });
  await form
    .getByRole("button", { name: "Получить предварительный разбор" })
    .click();
  await expect(name).toBeDisabled();
  await expect(form.getByRole("checkbox")).toBeDisabled();
  release();
  await expect(form.getByRole("status")).toContainText("Заявка принята");
  await expect(name).toBeEnabled();
});
