# Клиника в цифрах

Многостраничный сайт внешнего коммерческого контура для частных клиник. Проект связывает маркетинг, сайт, обращения, CRM, запись, визит, лечение, оплату и повторную работу в единую управленческую систему.

## Текущая публикация

Основной домен — `https://klinikavcifrah.ru`, статика обслуживается Nginx на VPS.
GitHub Actions собирает main, публикует атомарные релизы статики и приватного API,
затем проверяет публичные страницы и совпадение версий. Заявки сохраняются в SQLite
вне релизов, Telegram получает уведомления через очередь.

См. [публикацию и откат](docs/deployment.md), [реестр заявок](docs/stage-3-leads.md)
и [текущее состояние оставшихся этапов](docs/completion-status.md).
Для VPS используется `pnpm build:static`. Cloudflare-команды ниже оставлены для прежней
инфраструктуры; не запускайте их для обновления основного домена.

Production origin по умолчанию — основной HTTPS-домен. Сборка с `NEXT_PUBLIC_SITE_URL=http://localhost:3000` останавливается. Если нужен локальный origin для разработки, задавайте его только в окружении dev. После любой смены `NEXT_PUBLIC_*` production необходимо пересобрать.

## Реестр заявок на VPS

Приватный API подключён на VPS. Описание, резервирование и эксплуатация:
[docs/stage-3-leads.md](docs/stage-3-leads.md). Описанные ниже Cloudflare/Node варианты
относятся к прежней инфраструктуре и не заменяют действующий реестр.

## Стек

- Next.js 16 (App Router), React 19.2, TypeScript
- Tailwind CSS 4 и CSS Variables
- CSS-анимации
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

## Подписка на заявки на VPS

Для нового приватного API достаточно токена бота: установщик сам подключает webhook.
Получатели отправляют боту `/start`, `/stop` отключает подписку, `/status` проверяет её.
Chat ID вводить не нужно. После переноса с Cloudflare получатели нажимают `/start` заново.
Любой запустивший бота получает заявки с контактами. Подписки и заявки сохраняются в SQLite.
Команда установки и статус production: [docs/stage-3-leads.md](docs/stage-3-leads.md).

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Канонический адрес текущего окружения |
| `NEXT_PUBLIC_YANDEX_METRIKA_ID` | ID счётчика Яндекс Метрики |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Публичный ключ Cloudflare Turnstile |
| `TURNSTILE_SECRET_KEY` | Секретный ключ Turnstile |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота |
| `TELEGRAM_CHAT_ID` | Резервный чат старого Cloudflare/Node API; для VPS не нужен |
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

## Раздельный production: Pages + API Worker

Статический сайт собирается отдельно:

```bash
pnpm build:pages
```

Для Cloudflare Pages используйте команду `pnpm build:pages` и каталог результата `out`. Форма в этой сборке отправляет заявки на отдельный Worker `klinilavcifrah-api`.

Worker с Telegram webhook и API формы находится в `worker/`:

```bash
pnpm deploy:api
```

Ему нужны binding `TELEGRAM_SUBSCRIBERS` и secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`. После его публикации Telegram webhook должен указывать на `https://klinilavcifrah-api.eggetsevich.workers.dev/telegram/webhook`.

## Оставшиеся материалы и приёмка

Контакты, реквизиты, утверждённые документы и 11 услуг с ценами ожидаются от владельца.
Метрика отключена до получения ID. Полный список и ограничения проверки:
[docs/completion-status.md](docs/completion-status.md).

Поисковая карта: [docs/search-page-map.md](docs/search-page-map.md).
Условия отдельного проекта CRM: [docs/crm-delivery-conditions.md](docs/crm-delivery-conditions.md).
Три материала до экспертного согласования: [docs/editorial-drafts/README.md](docs/editorial-drafts/README.md).

## Этап 4: формы и источники

Валидация, доступность, UTM/CTA и подключение Метрики: [docs/stage-4-forms.md](docs/stage-4-forms.md).
Для включения внешней аналитики задайте Repository variable `NEXT_PUBLIC_YANDEX_METRIKA_ID` и повторите сборку актуального main.
