import { getCloudflareContext } from "@opennextjs/cloudflare";

type KvListResult = {
  keys: Array<{ name: string }>;
  cursor?: string;
  list_complete: boolean;
};

export type KvNamespace = {
  delete(key: string): Promise<void>;
  get(key: string): Promise<string | null>;
  list(options?: { cursor?: string; prefix?: string }): Promise<KvListResult>;
  put(key: string, value: string): Promise<void>;
};

type TelegramEnv = {
  TELEGRAM_SUBSCRIBERS?: KvNamespace;
};

export function getTelegramSubscribersKv() {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as TelegramEnv).TELEGRAM_SUBSCRIBERS;
  } catch {
    return undefined;
  }
}

export async function getSubscriberChatIds() {
  const ids = new Set<string>();
  const fallbackChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (fallbackChatId) ids.add(fallbackChatId);

  const kv = getTelegramSubscribersKv();
  if (!kv) return [...ids];

  let cursor: string | undefined;
  do {
    const result = await kv.list({ prefix: "subscriber:", cursor });
    for (const key of result.keys) ids.add(key.name.slice("subscriber:".length));
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return [...ids];
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(7000),
    },
  );
  const result = (await response.json()) as {
    ok?: boolean;
    description?: string;
  };
  if (!response.ok || result.ok !== true)
    throw new Error(result.description || "Telegram API error");
}
