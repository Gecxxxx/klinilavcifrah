import { NextRequest, NextResponse } from "next/server";
import {
  getTelegramSubscribersKv,
  sendTelegramMessage,
} from "@/lib/telegram";

export const runtime = "nodejs";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number };
    from?: { first_name?: string; username?: string };
    text?: string;
  };
};

function isAuthorized(request: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  return (
    !!expected &&
    request.headers.get("x-telegram-bot-api-secret-token") === expected
  );
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "telegram-webhook" });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request))
    return NextResponse.json({ ok: false }, { status: 401 });

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const chatId = update?.message?.chat?.id?.toString();
  const command = update?.message?.text?.trim().split(/\s+/)[0]?.toLowerCase();
  if (!chatId || !command) return NextResponse.json({ ok: true });

  const kv = getTelegramSubscribersKv();
  if (!kv)
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_SUBSCRIBERS binding is missing" },
      { status: 503 },
    );

  if (command === "/start" || command.startsWith("/start@")) {
    await kv.put(
      `subscriber:${chatId}`,
      JSON.stringify({
        chatId,
        firstName: update?.message?.from?.first_name || "",
        username: update?.message?.from?.username || "",
        subscribedAt: new Date().toISOString(),
      }),
    );
    await sendTelegramMessage(
      chatId,
      "✅ <b>Уведомления подключены</b>\n\nТеперь сюда будут приходить новые заявки с сайта «Клиника в цифрах».\n\n/stop — отключить уведомления\n/status — проверить подписку",
    );
  } else if (command === "/stop" || command.startsWith("/stop@")) {
    await kv.delete(`subscriber:${chatId}`);
    await sendTelegramMessage(
      chatId,
      "🔕 Уведомления отключены. Чтобы снова получать заявки, отправьте /start.",
    );
  } else if (command === "/status" || command.startsWith("/status@")) {
    const subscribed = await kv.get(`subscriber:${chatId}`);
    await sendTelegramMessage(
      chatId,
      subscribed
        ? "✅ Вы подписаны на новые заявки."
        : "ℹ️ Вы не подписаны. Отправьте /start, чтобы получать заявки.",
    );
  }

  return NextResponse.json({ ok: true });
}
