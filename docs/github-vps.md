# Автодеплой GitHub → VPS

Репозиторий: `Gecxxxx/klinilavcifrah`. Сайт: `https://klinikavcifrah.ru`.
VPS: `89.124.104.188`, каталог `/var/www/klinikavcifrah`.

## Что уже подготовлено

`.github/workflows/vps.yml` проверяет pull requests и изменения `main`: lint, тесты origin,
тесты публикации и изменения Nginx, чистая статическая сборка, typecheck и SEO экспорта.
Обработчик формы явно задан как `/api/leads`; существующий Nginx proxy в Worker сохраняется.
Артефакт сборки хранится в Actions 14 дней. Секреты VPS доступны только отдельному job
публикации из `main`. Изменения API Worker требуют отдельного выпуска и этим workflow не публикуются.

Публикация включается только после настройки `KVC_DEPLOY_ENABLED=true`. До этого сборка
работает, deploy job пропускается. Проверки в PR не требуют серверных секретов.

Готовый архив передаётся через SSH пользователю `kvc-deploy` без sudo. Проверяются архивный
SHA-256, исходный commit и SHA-256 всех файлов. Новый каталог создаётся отдельно, затем
ссылка `current` заменяется атомарно. HTTP-проверки контролируют marker commit, главную,
контакты, sitemap, robots, OG image, 404 и OPTIONS `/api/leads`. Настоящие заявки не отправляются.
При ошибке проверки или обрабатываемом сигнале ссылка возвращается на прежний релиз.
Отключение питания/SIGKILL не является проверенным сценарием автоматического отката.

Остаются пять созданных workflow релизов и импортированная исходная версия `5ab31de`.
Ресурсы непосредственно предыдущей сборки добавляются к новому релизу для открытых вкладок.
Изменения Nginx, сертификатов, Docker, баз данных и других сайтов скрипт публикации не делает.

## Одноразовое подключение

1. На доверенном компьютере Windows создайте **отдельную** пару ключей для Actions:

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\id_ed25519_kvc_deploy" -C "kvc-github-deploy"
```

Для автоматического подключения оставьте passphrase пустой. Существующий ключ `id_ed25519_kvc`
оставляется для личного доступа. Приватный ключ не отправляйте в чат и не коммитьте.

2. Из PowerShell передайте на сервер только публичный файл:

```powershell
scp -4 -i "$env:USERPROFILE\.ssh\id_ed25519_kvc" "$env:USERPROFILE\.ssh\id_ed25519_kvc_deploy.pub" root@89.124.104.188:/tmp/kvc-deploy.pub
ssh -4 -i "$env:USERPROFILE\.ssh\id_ed25519_kvc" root@89.124.104.188
```

3. После слияния этого изменения скачайте `deploy/setup-vps.sh` из проверенного commit
репозитория и просмотрите его. Например, заменив `COMMIT_SHA` на полный SHA этого выпуска:

```bash
curl -fLo /tmp/kvc-setup-vps.sh https://raw.githubusercontent.com/Gecxxxx/klinilavcifrah/COMMIT_SHA/deploy/setup-vps.sh
bash /tmp/kvc-setup-vps.sh /tmp/kvc-deploy.pub
```

Скрипт создаёт пользователя, устанавливает public key с опцией `restrict` и передаёт ему
владение только двумя каталогами: корнем **этого** сайта и `releases`. Рекурсивного chown
и изменений старых файлов нет. В конце выводится публичная строка ключа SSH **сервера**.
Её отпечаток можно сверить с `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` через существующий доверенный SSH-сеанс.

4. В GitHub → Settings → Secrets and variables → Actions → Secrets создайте:

| Secret | Значение |
| --- | --- |
| `KVC_SSH_PRIVATE_KEY` | Полное содержимое локального `id_ed25519_kvc_deploy`, включая BEGIN/END |
| `KVC_SSH_KNOWN_HOSTS` | Полная строка `89.124.104.188 ssh-ed25519 …` из последней команды setup |

Ключ можно скопировать в буфер локально, не выводя его в терминал:

```powershell
Get-Content -Raw "$env:USERPROFILE\.ssh\id_ed25519_kvc_deploy" | Set-Clipboard
```

5. Во вкладке Variables создайте repository variable `KVC_DEPLOY_ENABLED` со значением `true`.
В Actions выберите **Check and deploy VPS → Run workflow → main**.
Публикация разрешена только для текущего HEAD `main`; устаревшая сборка пропускается.
С этого момента новый push в `main` запускает проверки и публикацию автоматически.

Не включайте переменную до настройки двух secrets и серверного пользователя.
GitHub-коннектор не предоставляет API для установки этих secrets, поэтому эта одноразовая
операция выполняется владельцем репозитория в интерфейсе GitHub.

## Откат

Отключите `KVC_DEPLOY_ENABLED` на время ручного отката. Существующий SSH-пользователь root
может проверить `/var/www/klinikavcifrah/previous-release.txt` и переключить ссылку обратно:

```bash
(
set -eu
site=/var/www/klinikavcifrah
previous=$(cat "$site/previous-release.txt")
case "$previous" in "$site/releases/"*) ;; *) exit 1 ;; esac
test -d "$previous"
link="$site/current.rollback.$$"
trap 'rm -f "$link"' EXIT
ln -s "$previous" "$link"
mv -Tf "$link" "$site/current"
)
```

Выполняйте шаги только после успешной проверки пути; он должен находиться в `releases`.
Reload Nginx для замены ссылки не требуется. Хранилище заявок при откате не меняется.
После проверки сайта исправьте исходники и выпускайте новый commit, затем включите публикацию.

## Проверенная исходная версия

Рабочий архив VPS от 20.10.2026 сохранён в ветке `backup/live-vps-2026-10-20`,
файл `ops/baselines/kvc-live-2026-10-20.tar.gz`.
SHA-256: `1233c7fba85cbea528142ebe475373c0a1bc6b94e6ba21436cfd177ecbfb4dfd`.
Это снимок публичной статики; серверный Nginx backup и секреты хранятся отдельно.
Сверены тексты, ссылки, формы и изображения 9 страниц, 10 public файлов, активный CSS и
same-origin endpoint формы. Совпадают 13 из 16 активных JS; полное тождество исходников по сборке не утверждается.

Workflow и локальные сценарии проверены отдельно. Автодеплой считается подключённым только
после успешного реального запуска Actions и проверки опубликованного `__release.json`.

Дополнительно локально распакован фактический архив VPS, поверх отдельного каталога установлен
проверенный новый артефакт, выполнены реальные GET/OPTIONS через временный HTTP-сервер и
проверен возврат на исходный снимок. Это не проверка восстановления конфигурации реального Nginx/TLS.

## Одноразовый www → основной домен

Пользователь подтвердил через `openssl x509`: сертификат действует до 22.11.2026,
SAN содержит `klinikavcifrah.ru` и `www.klinikavcifrah.ru`.
`deploy/configure-canonical.py` запускается отдельно от Actions через личный root SSH.
Он принимает только известную структуру HTTPS-конфига этого сайта, сохраняет резервную
копию в отдельном каталоге `/root/backups/kvc-nginx-*`, разрешает symlink sites-enabled
и добавляет 308 с сохранением пути и query. Конфиг API и TLS сохраняется.
Перед reload выполняется `nginx -t`; при ошибке проверки или reload возвращается исходный
файл и выполняется проверка/reload. При неожиданной структуре конфигурации скрипт останавливается.
Повторный запуск с уже установленным правилом ничего не меняет.

Из PowerShell на личном компьютере, заменив `COMMIT_SHA` на проверенный полный commit:

```powershell
ssh -4 -o ConnectTimeout=15 -i "$env:USERPROFILE\.ssh\id_ed25519_kvc" root@89.124.104.188 "curl -fLo /tmp/kvc-canonical.py https://raw.githubusercontent.com/Gecxxxx/klinilavcifrah/COMMIT_SHA/deploy/configure-canonical.py && python3 /tmp/kvc-canonical.py"
```

Сохраните напечатанный путь backup. После установки проверьте GET
`https://www.klinikavcifrah.ru/kontakty?utm_source=kvc_verify`: ожидается 308 с Location
`https://klinikavcifrah.ru/kontakty?utm_source=kvc_verify`. Основной адрес должен отвечать
200, OPTIONS `/api/leads` — 204. HTTP www может сначала перейти на HTTPS www, затем на apex.
Локальные тесты проверяют точечное изменение, повторный запуск, отказ от неизвестной
структуры, сохранность symlink/прав и восстановление при отказе проверки/reload.
Настоящую конфигурацию проверяет Nginx на VPS; локального Nginx нет.
