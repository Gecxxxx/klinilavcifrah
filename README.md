# Клиника в цифрах

Многостраничный сайт внешнего коммерческого контура для частных клиник. Проект связывает маркетинг, сайт, обращения, CRM, запись, визит, лечение, оплату и повторную работу в единую управленческую систему.

## Стек

- Next.js 16 (App Router), React 19.2, TypeScript
- Tailwind CSS 4 и CSS Variables
- Motion for React
- React Hook Form + Zod
- Playwright
- OpenNext + Cloudflare Workers
- pnpm

## Локальный запуск

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Сайт откроется на `http://localhost:3000`.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Канонический адрес текущего окружения |
| `NEXT_PUBLIC_YANDEX_METRIKA_ID` | ID счётчика Яндекс Метрики |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Публичный ключ Cloudflare Turnstile |
| `TURNSTILE_SECRET_KEY` | Секретный ключ Turnstile |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота |
| `TELEGRAM_CHAT_ID` | ID чата для заявок |
| `TELEGRAM_WEBHOOK_SECRET` | Секрет проверки входящих webhook-запросов Telegram |

Секреты нельзя добавлять в Git или клиентский код. Для локальной разработки используйте `.env.local`, для Wrangler — `.dev.vars`.

## Проверки

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

Если Playwright установлен впервые:

```bash
pnpm exec playwright install chromium
```

## Telegram

1. Создайте бота через BotFather и получите токен.
2. Создайте KV namespace и привяжите его к Worker как `TELEGRAM_SUBSCRIBERS`.
3. Добавьте `TELEGRAM_BOT_TOKEN` и `TELEGRAM_WEBHOOK_SECRET` как серверные секреты.
4. Установите webhook на `https://klinikavcifrah.ru/api/telegram/webhook`, передав тот же `secret_token`.
5. Отправьте боту `/start`. Любой пользователь, сделавший это, будет получать заявки; `/stop` отключает уведомления.

`TELEGRAM_CHAT_ID` оставлен как необязательный резервный получатель и для новой схемы не требуется.

Endpoint `/api/leads` валидирует запрос через Zod, проверяет honeypot и Turnstile, ограничивает частоту запросов, добавляет ID заявки, страницу, referrer и UTM, затем подтверждает успешный ответ Telegram Bot API.

## Cloudflare Workers

Проект использует официальный адаптер `@opennextjs/cloudflare` и не является статическим экспортом.

```bash
pnpm build:cf
pnpm preview:cf
pnpm deploy:cf
```

Безопасно добавьте секреты:

```bash
pnpm wrangler secret put TELEGRAM_BOT_TOKEN
pnpm wrangler secret put TELEGRAM_CHAT_ID
pnpm wrangler secret put TELEGRAM_WEBHOOK_SECRET
pnpm wrangler secret put TURNSTILE_SECRET_KEY
```

Публичные переменные можно задать в Cloudflare Dashboard → Workers & Pages → Settings → Variables and Secrets. После назначения демонстрационного или production-домена установите `NEXT_PUBLIC_SITE_URL` в его фактический HTTPS-адрес и пересоберите проект.

Для подключения репозитория в Cloudflare выберите **Workers & Pages → Create → Import a repository**, укажите этот репозиторий, команду сборки `pnpm build:cf` и Worker entrypoint `.open-next/worker.js`. Альтернатива — выполнить `pnpm wrangler login`, затем `pnpm deploy:cf`.

## Будущий деплой на VPS

Проект сохраняет стандартный Node.js runtime и не связывает бизнес-логику формы с Cloudflare. На VPS:

1. установите Node.js 22+, pnpm и Nginx;
2. выполните `pnpm install --frozen-lockfile && pnpm build`;
3. добавьте переменные окружения через защищённый файл systemd;
4. запустите `pnpm start` как systemd service;
5. проксируйте домен через Nginx на `127.0.0.1:3000` и подключите TLS.

## Материалы, которые нужно добавить позже

- подтверждённые кейсы, компании и результаты;
- фотографии или утверждённые портреты команды;
- фактические контакты и ссылки на мессенджеры;
- реквизиты оператора персональных данных и финальные юридические тексты;
- production-домен и ID Яндекс Метрики.
