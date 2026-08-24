interface KvNamespace {
  delete(key: string): Promise<void>;
  get(key: string): Promise<string | null>;
  list(options?: {
    prefix?: string;
    cursor?: string;
  }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }>;
  put(key: string, value: string): Promise<void>;
}

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  TELEGRAM_SUBSCRIBERS: KvNamespace;
  TURNSTILE_SECRET_KEY?: string;
}

type Lead = {
  name: string;
  company: string;
  phone: string;
  website?: string;
  message?: string;
  consent: boolean;
  website_check?: string;
  page?: string;
  referrer?: string;
  turnstileToken?: string;
  utm?: Record<string, string>;
};

type TelegramUpdate = {
  message?: {
    chat?: { id?: number };
    from?: { first_name?: string; username?: string };
    text?: string;
  };
};

const allowedOrigins = new Set([
  "https://klinikavcifrah.ru",
  "https://www.klinikavcifrah.ru",
  "https://klinilavcifrah.pages.dev",
  "https://klinilavcifrah-site.pages.dev",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://klinikavcifrah.ru",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(request: Request, data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders(request) });
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char] || char,
  );
}

async function sendMessage(env: Env, chatId: string, text: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    },
  );
  const result = (await response.json()) as {
    ok?: boolean;
    description?: string;
  };
  if (!response.ok || result.ok !== true)
    throw new Error(result.description || "Telegram API error");
}

async function subscriberIds(env: Env) {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const result = await env.TELEGRAM_SUBSCRIBERS.list({
      prefix: "subscriber:",
      cursor,
    });
    for (const key of result.keys) ids.push(key.name.slice(11));
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return ids;
}

async function validateTurnstile(env: Env, token: string, ip: string) {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);
  body.append("remoteip", ip);
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

function validLead(value: unknown): value is Lead {
  if (!value || typeof value !== "object") return false;
  const lead = value as Partial<Lead>;
  return (
    typeof lead.name === "string" &&
    lead.name.trim().length >= 2 &&
    typeof lead.company === "string" &&
    lead.company.trim().length >= 2 &&
    typeof lead.phone === "string" &&
    lead.phone.trim().length >= 6 &&
    lead.consent === true &&
    !lead.website_check
  );
}

async function handleLead(request: Request, env: Env) {
  const lead = (await request.json().catch(() => null)) as unknown;
  if (!validLead(lead))
    return json(request, { ok: false, message: "Проверьте заполненные поля." }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!(await validateTurnstile(env, lead.turnstileToken || "", ip)))
    return json(
      request,
      { ok: false, message: "Не удалось подтвердить защиту формы." },
      400,
    );

  const ids = await subscriberIds(env);
  if (ids.length === 0)
    return json(
      request,
      { ok: false, message: "Получатели уведомлений ещё не подключены." },
      503,
    );

  const id = crypto.randomUUID();
  const utm =
    Object.entries(lead.utm || {})
      .map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(value)}`)
      .join("\n") || "не указаны";
  const text = [
    "<b>🟢 Новая заявка — Клиника в цифрах</b>",
    "",
    `<b>ID:</b> <code>${id}</code>`,
    `<b>Имя:</b> ${escapeHtml(lead.name.trim())}`,
    `<b>Клиника:</b> ${escapeHtml(lead.company.trim())}`,
    `<b>Контакт:</b> ${escapeHtml(lead.phone.trim())}`,
    `<b>Сайт:</b> ${escapeHtml(lead.website?.trim() || "не указан")}`,
    `<b>Задача:</b> ${escapeHtml(lead.message?.trim() || "не указана")}`,
    "",
    `<b>Страница:</b> ${escapeHtml(lead.page || "не определена")}`,
    `<b>Источник:</b> ${escapeHtml(lead.referrer || "прямой переход")}`,
    `<b>UTM:</b>\n${utm}`,
  ].join("\n");

  const results = await Promise.allSettled(
    ids.map((chatId) => sendMessage(env, chatId, text)),
  );
  if (!results.some((result) => result.status === "fulfilled"))
    return json(
      request,
      { ok: false, message: "Сервис отправки временно недоступен." },
      502,
    );

  return json(request, { ok: true, id });
}

async function handleWebhook(request: Request, env: Env) {
  if (
    request.headers.get("X-Telegram-Bot-Api-Secret-Token") !==
    env.TELEGRAM_WEBHOOK_SECRET
  )
    return new Response("Unauthorized", { status: 401 });

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const chatId = update?.message?.chat?.id?.toString();
  const command = update?.message?.text?.trim().split(/\s+/)[0]?.toLowerCase();
  if (!chatId || !command) return Response.json({ ok: true });

  if (command === "/start" || command.startsWith("/start@")) {
    await env.TELEGRAM_SUBSCRIBERS.put(
      `subscriber:${chatId}`,
      JSON.stringify({
        chatId,
        firstName: update?.message?.from?.first_name || "",
        username: update?.message?.from?.username || "",
        subscribedAt: new Date().toISOString(),
      }),
    );
    await sendMessage(
      env,
      chatId,
      "✅ <b>Уведомления подключены</b>\n\nТеперь сюда будут приходить новые заявки с сайта «Клиника в цифрах».\n\n/stop — отключить уведомления\n/status — проверить подписку",
    );
  } else if (command === "/stop" || command.startsWith("/stop@")) {
    await env.TELEGRAM_SUBSCRIBERS.delete(`subscriber:${chatId}`);
    await sendMessage(
      env,
      chatId,
      "🔕 Уведомления отключены. Чтобы снова получать заявки, отправьте /start.",
    );
  } else if (command === "/status" || command.startsWith("/status@")) {
    const subscribed = await env.TELEGRAM_SUBSCRIBERS.get(`subscriber:${chatId}`);
    await sendMessage(
      env,
      chatId,
      subscribed
        ? "✅ Вы подписаны на новые заявки."
        : "ℹ️ Вы не подписаны. Отправьте /start, чтобы получать заявки.",
    );
  }
  return Response.json({ ok: true });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (url.pathname === "/health")
      return Response.json({ ok: true, service: "klinilavcifrah-api" });
    if (url.pathname === "/api/leads" && request.method === "POST")
      return handleLead(request, env);
    if (url.pathname === "/telegram/webhook" && request.method === "POST")
      return handleWebhook(request, env);
    return new Response("Not found", { status: 404 });
  },
};

export default worker;
