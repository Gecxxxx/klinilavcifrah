"""Private WSGI API behind the site's exact Nginx /api/leads location."""
from dataclasses import dataclass
import hashlib
import hmac
import html
import json
import logging
import os
from pathlib import Path
import re
import sqlite3
import urllib.parse
import urllib.request
from backend.store import Rejected, Store
from backend.bot import webhook

ORIGINS = {"https://klinikavcifrah.ru", "https://www.klinikavcifrah.ru"}
MAX_BODY = 16384


@dataclass(frozen=True)
class Config:
    db: Path
    ip_key: str
    token: str = ""
    chat_ids: tuple = ()
    turnstile_secret: str = ""
    policy_version: str = "soglasheniya-pending-review-2026-10-20"
    revision: str = "development"
    recipient_mode: str = "fixed"
    webhook_secret: str = ""

    @classmethod
    def environment(cls):
        config = cls(Path(os.environ.get("KVC_DB", "/var/lib/kvc-leads/leads.sqlite3")),
                     os.environ.get("KVC_IP_HASH_KEY", ""), os.environ.get("TELEGRAM_BOT_TOKEN", ""),
                     tuple(filter(None, os.environ.get("TELEGRAM_CHAT_IDS", "").split(","))),
                     os.environ.get("TURNSTILE_SECRET_KEY", ""),
                     os.environ.get("KVC_POLICY_VERSION", cls.policy_version),
                     Path(__file__).with_name("revision.txt").read_text().strip()
                     if Path(__file__).with_name("revision.txt").exists() else "development",
                     os.environ.get("TELEGRAM_RECIPIENT_MODE", "fixed"),
                     os.environ.get("TELEGRAM_WEBHOOK_SECRET", ""))
        if len(config.ip_key) < 32:
            raise RuntimeError("KVC_IP_HASH_KEY must be configured")
        if config.recipient_mode == "fixed" and (len(config.chat_ids) > 5 or any(not re.fullmatch(r"-?[0-9]{1,20}", x) for x in config.chat_ids)):
            raise RuntimeError("Invalid Telegram recipient configuration")
        if config.recipient_mode not in ("fixed", "subscribers"):
            raise RuntimeError("Invalid Telegram recipient mode")
        if config.recipient_mode == "subscribers" and not re.fullmatch(r"[A-Za-z0-9_-]{32,256}", config.webhook_secret):
            raise RuntimeError("Telegram webhook secret must be configured")
        return config


def validated(value):
    if not isinstance(value, dict) or value.get("consent") is not True or value.get("website_check", "") != "":
        raise Rejected(400, "Проверьте поля и согласие на обработку данных.")
    lead = {}
    for key, lower, upper in (("name", 2, 100), ("company", 2, 160), ("phone", 6, 100),
                               ("website", 0, 300), ("message", 0, 1000), ("page", 0, 300),
                               ("referrer", 0, 500), ("landingPage", 0, 300)):
        text = value.get(key, "")
        if not isinstance(text, str) or not lower <= len(text.strip()) <= upper or "\x00" in text:
            raise Rejected(400, "Проверьте заполненные поля.")
        lead[key] = text.strip()
    contact = lead["phone"]
    if not (len(re.sub(r"\D", "", contact)) >= 6 or re.fullmatch(r"@\w{5,32}", contact, re.ASCII)
            or re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", contact)
            or re.fullmatch(r"(?:https://)?t\.me/[A-Za-z0-9_]{5,32}", contact)):
        raise Rejected(400, "Укажите телефон, email или Telegram-контакт.")
    if lead["website"] and not re.fullmatch(r"(?:https?://)?[^\s/]+\.[^\s]+", lead["website"]):
        raise Rejected(400, "Проверьте адрес сайта.")
    utm = value.get("utm", {})
    if not isinstance(utm, dict) or len(utm) > 10:
        raise Rejected(400, "Проверьте данные источника.")
    lead["utm"] = {}
    for key in ("utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"):
        if key in utm:
            if not isinstance(utm[key], str) or len(utm[key]) > 200:
                raise Rejected(400, "Проверьте данные источника.")
            lead["utm"][key] = utm[key]
    # Optional metadata is added only when supplied: legacy in-flight request IDs
    # must retain their original normalized payload/fingerprint on replay.
    for key, allowed in (("interest", {"crm_custom"}), ("product", {"preliminary_review"}),
                         ("direction", {"general", "marketing", "digital", "commercial"})):
        if key in value:
            if not isinstance(value[key], str) or value[key] not in allowed:
                raise Rejected(400, "Проверьте данные источника.")
            lead[key] = value[key]
    for key, maximum in (("ctaPage", 300), ("ctaLocation", 80)):
        if key in value:
            if not isinstance(value[key], str) or len(value[key]) > maximum or "\x00" in value[key]:
                raise Rejected(400, "Проверьте данные источника.")
            lead[key] = value[key]
    lead["consent"] = True
    request_id = value.get("requestId")
    if request_id is not None and (not isinstance(request_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{20,80}", request_id)):
        raise Rejected(400, "Некорректный идентификатор отправки.")
    token = value.get("turnstileToken", "")
    if not isinstance(token, str) or len(token) > 2048:
        raise Rejected(400, "Некорректные данные защиты формы.")
    return lead, request_id, token


def verify_turnstile(secret, token, ip):
    if not secret:
        return True
    if not token:
        return False
    body = urllib.parse.urlencode({"secret": secret, "response": token, "remoteip": ip}).encode()
    request = urllib.request.Request("https://challenges.cloudflare.com/turnstile/v0/siteverify", data=body)
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response).get("success") is True


class Application:
    def __init__(self, config, verifier=verify_turnstile):
        self.config, self.verify = config, verifier
        self.store = Store(config.db)
        self.store.initialize()

    def __call__(self, environ, start_response):
        origin = environ.get("HTTP_ORIGIN", "")
        native = (environ.get("PATH_INFO") == "/api/leads" and environ.get("REQUEST_METHOD") == "POST"
                  and environ.get("CONTENT_TYPE", "").split(";")[0].lower() == "application/x-www-form-urlencoded")
        headers = [("Content-Type", "text/html; charset=utf-8" if native else "application/json; charset=utf-8"), ("Cache-Control", "no-store"),
                   ("X-Content-Type-Options", "nosniff"), ("Vary", "Origin"),
                   ("X-KVC-API-Revision", self.config.revision)]
        if origin in ORIGINS:
            headers += [("Access-Control-Allow-Origin", origin), ("Access-Control-Allow-Headers", "Content-Type"),
                        ("Access-Control-Allow-Methods", "POST, OPTIONS")]
        try:
            status, payload = self.handle(environ, origin)
        except Rejected as error:
            status, payload = error.status, {"ok": False, "saved": False, "message": error.message}
        except Exception:
            # Never log the request body, URL credentials, contact, token or raw provider exception.
            logging.error("lead_registry_request_failed")
            status, payload = 503, {"ok": False, "saved": False, "message": "Не удалось подтвердить сохранение. Повторите отправку с теми же данными."}
        descriptions = {200: "OK", 204: "No Content", 400: "Bad Request", 403: "Forbidden", 404: "Not Found",
                        409: "Conflict", 413: "Content Too Large", 415: "Unsupported Media Type", 429: "Too Many Requests", 503: "Service Unavailable"}
        if status == 429:
            headers.append(("Retry-After", "60"))
        body = (native_response(status, payload) if native else
                b"" if status == 204 else json.dumps(payload, ensure_ascii=False).encode())
        headers.append(("Content-Length", str(len(body))))
        start_response(f"{status} {descriptions[status]}", headers)
        return [body]

    def handle(self, environ, origin):
        path, method = environ.get("PATH_INFO"), environ.get("REQUEST_METHOD")
        if path == "/api/telegram/webhook":
            return webhook(self.config, self.store, environ)
        if path == "/health" and method == "GET":
            if not self.store.ready():
                raise RuntimeError("Registry not ready")
            return 200, {"ok": True, "service": "kvc-leads", "storage": "sqlite", "revision": self.config.revision}
        if path != "/api/leads":
            return 404, {"ok": False}
        if origin and origin not in ORIGINS:
            raise Rejected(403, "Недопустимый источник запроса.")
        if method == "OPTIONS":
            if not self.store.ready():
                raise RuntimeError("Registry not ready")
            return 204, None
        if method != "POST":
            return 404, {"ok": False}
        content_type = environ.get("CONTENT_TYPE", "").split(";")[0].lower()
        if content_type not in ("application/json", "application/x-www-form-urlencoded"):
            raise Rejected(415, "Ожидается JSON или контактная форма.")
        try:
            length = int(environ.get("CONTENT_LENGTH", "0"))
        except ValueError:
            raise Rejected(400, "Некорректный запрос.") from None
        if length <= 0 or length > MAX_BODY:
            raise Rejected(413, "Превышен размер запроса.")
        try:
            raw = environ["wsgi.input"].read(length)
            if len(raw) != length:
                raise ValueError()
            if content_type == "application/json":
                value = json.loads(raw)
            else:
                fields = urllib.parse.parse_qs(raw.decode("utf-8"), keep_blank_values=True, max_num_fields=20, errors="strict")
                if any(len(items) != 1 for items in fields.values()):
                    raise ValueError()
                value = {key: items[0] for key, items in fields.items()}
                value["consent"] = value.get("consent") in ("on", "true")
                value["turnstileToken"] = value.get("cf-turnstile-response", "")
                # Only a non-personal interest marker is recovered from our own
                # page's referrer. Never store the raw header or its query string.
                referer = urllib.parse.urlsplit(environ.get("HTTP_REFERER", ""))
                if (referer.scheme + "://" + referer.netloc in ORIGINS
                        and urllib.parse.parse_qs(referer.query).get("interest") == ["crm_custom"]):
                    value["interest"] = "crm_custom"
                    value["direction"] = "digital"
        except (ValueError, UnicodeError):
            raise Rejected(400, "Проверьте заполненные поля.") from None
        lead, request_id, token = validated(value)
        # Nginx overwrites X-Real-IP; the service only listens on loopback.
        ip = environ.get("HTTP_X_REAL_IP", "unknown")
        ip_key = hmac.new(self.config.ip_key.encode(), ip.encode(), hashlib.sha256).hexdigest()
        # Replay checks before one-use CAPTCHA verification: an already committed request
        # must remain recoverable after its HTTP response was lost.
        if request_id:
            with self.store.connection() as con:
                exists = con.execute("SELECT 1 FROM leads WHERE request_id=?", (request_id,)).fetchone()
            if exists:
                lead_id, duplicate = self.store.save(lead, request_id, ip_key, self.config.policy_version)
                return 200, {"ok": True, "saved": True, "id": lead_id, "duplicate": duplicate}
        if not self.verify(self.config.turnstile_secret, token, ip):
            raise Rejected(400, "Не удалось подтвердить защиту формы.")
        lead_id, duplicate = self.store.save(lead, request_id, ip_key, self.config.policy_version)
        return 200, {"ok": True, "saved": True, "id": lead_id, "duplicate": duplicate}


def create_app():
    return Application(Config.environment())


def native_response(status, payload):
    saved = status == 200 and payload.get("saved") is True
    title = "Заявка принята" if saved else "Заявка не подтверждена"
    message = ("Заявка сохранена. Номер: " + str(payload["id"]) if saved else
               payload.get("message", "Проверьте данные или попробуйте позже."))
    return (f'<!doctype html><html lang="ru"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<meta name="robots" content="noindex,nofollow"><title>{title} — Клиника в цифрах</title>'
            '<style>body{font:18px/1.6 system-ui,sans-serif;max-width:640px;margin:10vh auto;padding:24px;color:#101d33}'
            'h1{font-size:2rem}p{overflow-wrap:anywhere}a{color:#075985}</style></head>'
            f'<body><main><h1>{title}</h1><p>{html.escape(message)}</p>'
            '<p><a href="/kontakty#forma">Вернуться на сайт</a></p></main></body></html>').encode()
