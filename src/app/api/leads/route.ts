import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getSubscriberChatIds,
  sendTelegramMessage,
} from "@/lib/telegram";

export const runtime = "nodejs";

const leadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(6).max(100),
  website: z.string().trim().max(300).optional().default(""),
  message: z.string().trim().max(1000).optional().default(""),
  consent: z.literal(true),
  website_check: z.string().max(0).optional().default(""),
  page: z.string().max(300).optional().default(""),
  referrer: z.string().max(500).optional().default(""),
  turnstileToken: z.string().optional().default(""),
  utm: z.record(z.string(), z.string()).optional().default({}),
});

const requests = new Map<string, number[]>();
const recentLeads = new Map<string, number>();

function isRateLimited(ip: string) {
  const now = Date.now();
  const recent = (requests.get(ip) || []).filter((time) => now - time < 60_000);
  recent.push(now);
  requests.set(ip, recent);
  return recent.length > 5;
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

async function validateTurnstile(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!token) return false;
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  body.append("remoteip", ip);
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body, signal: AbortSignal.timeout(5000) },
  );
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (isRateLimited(ip))
    return NextResponse.json(
      { ok: false, message: "Слишком много попыток. Попробуйте через минуту." },
      { status: 429 },
    );

  const parsed = leadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.website_check)
    return NextResponse.json(
      { ok: false, message: "Проверьте заполненные поля." },
      { status: 400 },
    );
  if (!(await validateTurnstile(parsed.data.turnstileToken, ip)))
    return NextResponse.json(
      { ok: false, message: "Не удалось подтвердить защиту формы." },
      { status: 400 },
    );

  if (!process.env.TELEGRAM_BOT_TOKEN)
    return NextResponse.json(
      { ok: false, message: "Канал заявок ещё не подключён." },
      { status: 503 },
    );

  const lead = parsed.data;
  const duplicateKey = [
    ip,
    lead.phone.toLowerCase(),
    lead.company.toLowerCase(),
    lead.message.toLowerCase(),
  ].join("|");
  const previousAttempt = recentLeads.get(duplicateKey);
  if (previousAttempt && Date.now() - previousAttempt < 120_000)
    return NextResponse.json(
      { ok: false, message: "Эта заявка уже отправлена." },
      { status: 409 },
    );
  recentLeads.set(duplicateKey, Date.now());

  const id = crypto.randomUUID();
  const utm =
    Object.entries(lead.utm)
      .map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(value)}`)
      .join("\n") || "не указаны";
  const message = [
    "<b>🟢 Новая заявка — Клиника в цифрах</b>",
    "",
    `<b>ID:</b> <code>${id}</code>`,
    `<b>Имя:</b> ${escapeHtml(lead.name)}`,
    `<b>Клиника:</b> ${escapeHtml(lead.company)}`,
    `<b>Контакт:</b> ${escapeHtml(lead.phone)}`,
    `<b>Сайт:</b> ${escapeHtml(lead.website || "не указан")}`,
    `<b>Задача:</b> ${escapeHtml(lead.message || "не указана")}`,
    "",
    `<b>Страница:</b> ${escapeHtml(lead.page || "не определена")}`,
    `<b>Источник:</b> ${escapeHtml(lead.referrer || "прямой переход")}`,
    `<b>UTM:</b>\n${utm}`,
    `<b>Дата:</b> ${new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow" }).format(new Date())}`,
  ].join("\n");

  try {
    const chatIds = await getSubscriberChatIds();
    if (chatIds.length === 0) throw new Error("No Telegram subscribers");
    const results = await Promise.allSettled(
      chatIds.map((chatId) => sendTelegramMessage(chatId, message)),
    );
    if (!results.some((result) => result.status === "fulfilled"))
      throw new Error("Telegram delivery failed for every subscriber");
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    recentLeads.delete(duplicateKey);
    console.error(
      "Lead delivery failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { ok: false, message: "Сервис отправки временно недоступен." },
      { status: 502 },
    );
  }
}
