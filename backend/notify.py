"""Durable, leased outbox. No notification work runs inside a form request."""
import json
import socket
import urllib.error
import urllib.request
from backend.store import Store


class DeliveryError(Exception):
    def __init__(self, code, retry_after=0):
        self.code, self.retry_after = code, retry_after
        super().__init__(code)


def telegram(config, chat_id, text):
    body = json.dumps({"chat_id": chat_id, "text": text, "disable_web_page_preview": True}).encode()
    request = urllib.request.Request(f"https://api.telegram.org/bot{config.token}/sendMessage", data=body,
                                     headers={"Content-Type": "application/json", "User-Agent": "kvc-leads/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=7) as response:
            result = json.loads(response.read(65536))
    except urllib.error.HTTPError as error:
        retry = 0
        try:
            data = json.loads(error.read(65536))
            retry = int(data.get("parameters", {}).get("retry_after", 0))
        except (ValueError, TypeError, AttributeError):
            pass
        raise DeliveryError(f"telegram_http_{error.code}", retry) from None
    except (urllib.error.URLError, TimeoutError, socket.timeout, OSError):
        raise DeliveryError("transport_error") from None
    except (ValueError, UnicodeError):
        raise DeliveryError("invalid_provider_response") from None
    if not isinstance(result, dict) or result.get("ok") is not True:
        raise DeliveryError("telegram_rejected")
    message_id = result.get("result", {}).get("message_id")
    if not isinstance(message_id, int):
        raise DeliveryError("missing_message_id")
    return message_id


def notification_text(job):
    lead = json.loads(job["payload"])
    parts = ["Новая заявка — Клиника в цифрах", f"ID реестра: {job['lead_id']}",
             f"Имя: {lead['name']}", f"Клиника: {lead['company']}", f"Контакт: {lead['phone']}",
             f"Сайт: {lead['website'] or 'не указан'}", f"Задача: {lead['message'] or 'не указана'}",
             f"Страница: {lead['page'] or 'не определена'}", f"Источник: {lead['referrer'] or 'не определён'}",
             f"Первая страница: {lead['landingPage'] or 'не определена'}",
             "UTM: " + json.dumps(lead['utm'], ensure_ascii=False)]
    # Telegram's size limit is in UTF-16 units; leave space for service text.
    text = "\n".join(parts)
    return text.encode("utf-16-le")[:7000].decode("utf-16-le", errors="ignore")


def drain(config, send=telegram, limit=5, now=None):
    store = Store(config.db)
    for _ in range(limit):
        job = store.claim(now)
        if not job:
            break
        codes, retry_after = [], 0
        subscribed = config.recipient_mode == "subscribers"
        if not config.token or (not subscribed and not config.chat_ids):
            store.record_delivery(job, "", "failed", "configuration_missing", now=now)
            store.finish(job, False, "configuration_missing", retry_after=600, now=now)
            continue
        targets = store.subscriber_targets(job) if subscribed else [(x, None) for x in config.chat_ids]
        if targets is None:
            store.defer(job, "waiting_subscribers", now=now)
            continue
        for chat_id, generation in targets[:4] if subscribed else targets:
            if subscribed and not store.subscriber_active(chat_id, generation):
                continue
            if store.delivered(job["lead_id"], chat_id):
                continue
            try:
                message_id = send(config, chat_id, notification_text(job))
                store.record_delivery(job, chat_id, "delivered", message_id=message_id, now=now)
            except DeliveryError as error:
                codes.append(error.code)
                retry_after = max(retry_after, error.retry_after)
                store.record_delivery(job, chat_id, "failed", error.code, now=now)
            except Exception:
                codes.append("notification_error")
                store.record_delivery(job, chat_id, "failed", "notification_error", now=now)
        if not codes and subscribed and len(targets) > 4:
            store.defer(job, "recipient_batch", now=now)
        else:
            store.finish(job, not codes, ",".join(sorted(set(codes))), retry_after=retry_after, now=now)
