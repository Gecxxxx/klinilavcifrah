"""Telegram-authenticated private-chat subscriptions; no manual chat IDs."""
import hmac
import json
import re
from backend.store import Rejected


def webhook(config, store, environ):
    if config.recipient_mode != "subscribers" or environ.get("REQUEST_METHOD") != "POST":
        return 404, {"ok": False}
    supplied = environ.get("HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN", "")
    if not config.webhook_secret or not hmac.compare_digest(supplied.encode(), config.webhook_secret.encode()):
        raise Rejected(403, "Forbidden")
    if environ.get("CONTENT_TYPE", "").split(";")[0].lower() != "application/json":
        raise Rejected(415, "JSON required")
    try:
        length = int(environ.get("CONTENT_LENGTH", "0"))
    except ValueError:
        raise Rejected(400, "Invalid request") from None
    if not 0 < length <= 32768:
        raise Rejected(413, "Request too large")
    try:
        update = json.loads(environ["wsgi.input"].read(length))
    except (ValueError, UnicodeError):
        raise Rejected(400, "Invalid JSON") from None
    message = update.get("message") if isinstance(update, dict) else None
    if not isinstance(message, dict):
        return 200, {"ok": True}
    chat, sender = message.get("chat"), message.get("from")
    if not isinstance(chat, dict) or not isinstance(sender, dict):
        return 200, {"ok": True}
    chat_id = chat.get("id")
    if (chat.get("type") != "private" or type(chat_id) is not int or not 0 < chat_id < 2**52
            or sender.get("id") != chat_id or sender.get("is_bot") is not False
            or message.get("business_connection_id") or message.get("guest_query_id")):
        return 200, {"ok": True}
    text = message.get("text", "")
    if not isinstance(text, str) or not text.strip():
        return 200, {"ok": True}
    command = re.fullmatch(r"/(start|stop|status)(?:@[A-Za-z0-9_]{5,32})?", text.strip().split()[0].lower())
    if not command:
        return 200, {"ok": True}
    stamp, message_id = message.get("date"), message.get("message_id")
    if type(stamp) is not int or type(message_id) is not int or stamp <= 0 or message_id <= 0:
        return 200, {"ok": True}
    active = store.bot_command(str(chat_id), command[1], stamp, message_id)
    if active:
        reply = "✅ Вы подписаны на заявки сайта «Клиника в цифрах».\n/stop — отключить уведомления\n/status — проверить подписку"
    else:
        reply = "🔕 Вы не подписаны на заявки.\n/start — подключить уведомления\n/status — проверить подписку"
    # Telegram supports invoking sendMessage in the webhook response. Subscription
    # is committed first; this informational reply is best effort, unlike lead outbox.
    return 200, {"method": "sendMessage", "chat_id": chat_id, "text": reply}
