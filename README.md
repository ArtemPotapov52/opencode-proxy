# opencode-proxy

OpenAI-compatible local proxy for OpenCode Zen free models. It runs on your machine, listens on `127.0.0.1` by default, exposes `http://127.0.0.1:3000/v1`, and lets OpenCode Desktop use a small free-model pool through a dedicated `Local Zen Proxy` provider.

This is an independent community project. It is not built by, endorsed by, or affiliated with the OpenCode team.

**English**: see [English setup](#english-setup).  
**Русский**: см. [Русская инструкция](#russian-setup).

---

<a id="russian-setup"></a>
## Русская инструкция

### Что это делает

Проект поднимает локальный OpenAI-compatible endpoint:

```text
http://127.0.0.1:3000/v1
```

OpenCode Desktop подключается к нему как к провайдеру `Local Zen Proxy`, а proxy пересылает запросы в:

```text
https://opencode.ai/zen/v1
```

По умолчанию используется ключ `public` и бесплатный пул моделей:

```text
deepseek-v4-flash-free
mimo-v2.5-free
north-mini-code-free
nemotron-3-ultra-free
big-pickle
```

Это не обход подписки и не вечный безлимит. Доступность free-моделей зависит от OpenCode Zen.

### Самый простой старт для Windows

Нужно установить две вещи:

1. Установите OpenCode Desktop: [opencode.ai/download](https://opencode.ai/download) -> Windows x64 Desktop Beta.
2. Установите Node.js 18+ с официального сайта: [nodejs.org/en/download](https://nodejs.org/en/download). Рекомендуется текущая LTS-версия.
3. Скачайте или клонируйте этот репозиторий.
4. В PowerShell перейдите в папку проекта:

```powershell
cd C:\project\opencode
```

5. Один раз выполните первичную настройку:

```powershell
.\run-opencode-proxy.cmd
```

Скрипт настроит уже установленный OpenCode Desktop, затем запустит локальный proxy. Окно proxy должно оставаться открытым, пока вы работаете в OpenCode Desktop.

6. Перезапустите OpenCode Desktop.
7. В выборе моделей используйте `Local Zen Proxy`.

После первичной настройки для обычного ежедневного запуска используйте:

```powershell
.\open-opencode.cmd
```

Этот launcher проверит proxy, при необходимости запустит его в отдельном окне, дождется `/health`, а потом откроет OpenCode Desktop. Это самый простой способ избежать `ECONNREFUSED 127.0.0.1:3000`.

### Factory Droid / Mission / Validation

Factory Droid тоже может работать через этот proxy как BYOK/custom OpenAI-compatible model. Это полезно, когда подписка Factory-managed models закончилась, но Factory разрешает использовать свои custom models.

1. Установите Factory Desktop/Droid: [factory.ai/product/desktop](https://factory.ai/product/desktop) или CLI по инструкции [docs.factory.ai](https://docs.factory.ai/cli/getting-started/quickstart).
2. Запустите локальный proxy:

```powershell
.\start-proxy.cmd
```

3. Закройте Factory Desktop/Droid, чтобы он перечитал конфиги после настройки.
4. Выполните:

```powershell
.\setup-factory-droid.cmd
```

Скрипт обновит:

- `%USERPROFILE%\.factory\settings.json`;
- `%USERPROFILE%\.factory\factory-settings.json`;
- уже созданные `%USERPROFILE%\.factory\missions\*\model-settings.json`, если они есть.

Он добавит 4 OpenCode Proxy модели:

```text
deepseek-v4-flash-free [OpenCode Proxy]
mimo-v2.5-free [OpenCode Proxy]
north-mini-code-free [OpenCode Proxy]
nemotron-3-ultra-free [OpenCode Proxy]
```

По умолчанию:

- обычный чат: `deepseek-v4-flash-free`;
- Mission worker: `mimo-v2.5-free`;
- Validation worker: `deepseek-v4-flash-free`;
- reasoning для Mission/Validation: `none`, чтобы не отправлять лишние параметры в бесплатный OpenAI-compatible endpoint.

После этого снова откройте Factory. В обычном чате и в Mission должны появиться модели с пометкой `[OpenCode Proxy]`.

Если в уже созданной Mission validation всё ещё показывает старую модель, проверьте файл:

```text
%USERPROFILE%\.factory\missions\<mission-id>\model-settings.json
```

Там должны быть такие значения:

```json
{
  "workerModel": "custom:opencode-mimo-v2-5-free",
  "workerReasoningEffort": "none",
  "validationWorkerModel": "custom:opencode-deepseek-v4-flash-free",
  "validationWorkerReasoningEffort": "none"
}
```

Для проверки proxy:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

### Раздельная настройка

Если нужно выполнить шаги отдельно:

```powershell
.\install-opencode.cmd
```

Скрипт:

- создаст или обновит `%USERPROFILE%\.config\opencode\opencode.jsonc`;
- сделает бэкап текущего конфига рядом с файлом;
- добавит провайдера `zenproxy`;
- установит пакет `@ai-sdk/openai-compatible`;
- выставит модели `zenproxy/deepseek-v4-flash-free` и `zenproxy/mimo-v2.5-free`.

Затем запустите proxy:

```powershell
.\start-proxy.cmd
```

Или запускайте proxy и OpenCode Desktop вместе:

```powershell
.\open-opencode.cmd
```

### Диагностика

Если что-то не работает:

```powershell
.\doctor.cmd
```

Он проверит Node.js, пакет `@ai-sdk/openai-compatible`, конфиг OpenCode, default-модель, `/health` и `/v1/models`.

Проверить, какие free-модели реально отвечают сейчас:

```powershell
.\model-health.cmd
.\model-health.cmd --compact
.\model-health.cmd --json
.\model-health.cmd --fail-on warning
```

Локальная панель аналитики:

```text
http://127.0.0.1:3000/dashboard
```

JSON-метрики для автоматизации:

```text
http://127.0.0.1:3000/metrics
```

Суточная история расхода:

```text
http://127.0.0.1:3000/usage?days=7
```

Текущие наблюдаемые лимиты:

```text
http://127.0.0.1:3000/limits
```

Dashboard показывает 4 основные модели, запросы, токены/минуту, среднюю задержку, ошибки, расход по дням и лимиты. Когда upstream отдаёт `Retry-After`, reset headers или remaining/limit headers, dashboard показывает эти значения. Если upstream не отдаёт точный остаток, отображается `API не передал`, а суточный расход считается по локальной истории. Если upstream не отдаёт `usage`, proxy считает приблизительные токены по длине запроса/ответа и показывает их с префиксом `≈`.

История по умолчанию пишется в:

```text
%USERPROFILE%\.config\opencode-proxy\usage.jsonl
```

Это обычный JSONL-файл. В него не пишутся промпты, ответы, ключи, пути проектов и session id. Сохраняются только технические поля: модель, HTTP-статус, latency, usage tokens, cost, класс ошибки и признаки rate-limit.

### Ручной запуск

```powershell
npm start
```

Проверка:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/v1/models
Invoke-RestMethod http://127.0.0.1:3000/metrics
Invoke-RestMethod http://127.0.0.1:3000/usage?days=7
Invoke-RestMethod http://127.0.0.1:3000/limits
```

### Конфиг

Переменные окружения:

| Переменная | По умолчанию |
|---|---|
| `OPENCODE_ZEN_API_KEY` | `public` |
| `HOST` | `127.0.0.1` |
| `PORT` | `3000` |
| `MODELS` | free-модели через запятую |
| `PRIMARY_MODELS` | 4 модели для верхних карточек dashboard |
| `ROUTING` | `round-robin` или `random` |
| `UPSTREAM_URL` | `https://opencode.ai/zen/v1` |
| `UPSTREAM_TIMEOUT` | `30000` мс |
| `METRICS_MAX_EVENTS` | `2000` событий в памяти |
| `USAGE_DB_PATH` | `%USERPROFILE%\.config\opencode-proxy\usage.jsonl`; `off` отключает файл |
| `USAGE_RETENTION_DAYS` | `30` дней для локальной истории |

Пример с конкретным портом:

```powershell
$env:PORT = "3010"
npm start
```

Тогда OpenCode provider base URL должен быть:

```text
http://127.0.0.1:3010/v1
```

### Как это работает

- Proxy по умолчанию слушает только `127.0.0.1`, а не всю локальную сеть.
- `GET /health` показывает статус proxy.
- `GET /dashboard` показывает локальную dashboard-панель.
- `GET /metrics` возвращает privacy-safe JSON-метрики, статус 4 основных моделей и суточный расход.
- `GET /usage?days=7` возвращает локальную историю расхода по дням и моделям.
- `GET /limits` возвращает последние наблюдаемые 429/rate-limit reset по моделям.
- `GET /v1/models` возвращает локальный список моделей.
- `POST /v1/chat/completions` принимает OpenAI-format запрос и пересылает его в OpenCode Zen.
- Если `model` не указан, равен `auto`, или отсутствует в локальном пуле, proxy выбирает следующую модель по `round-robin`.
- Если `model` есть в пуле, используется именно она.
- Выбранная модель возвращается в заголовке `X-Model-Used`.

### Почему не Rust

Текущая версия уже без npm-зависимостей: только Node.js 18+ и встроенные `http`/`fetch`. Python не нужен. Для коллег это проще, чем собирать бинарники.

Rust-версия возможна как следующий этап: один `.exe` launcher/doctor, автозапуск и tray/служба. Но для HTTPS, JSON и OpenAI-compatible proxy всё равно понадобятся crates, просто они будут запакованы в бинарник. Практичный первый шаг — автоматическая настройка OpenCode плюс простой запуск proxy.

### Что можно улучшить дальше

- Release zip без бинарников: только исходники, `.cmd`, `.ps1`, README и тесты. Это прозрачнее для коллег, чем неизвестный `.exe`.
- Защищенный серверный fallback через `ssh -L`, если локальная сеть/DNS иногда ломает доступ.
- Экспорт dashboard в JSON/CSV для отчета по расходу.
- Автоочистка старой истории `%USERPROFILE%\.config\opencode-proxy\usage.jsonl`.
- Калибровка примерной оценки токенов, когда upstream не возвращает `usage`.
- Optional Rust helper позже: только launcher/doctor, а не обязательный способ установки.

### Риски и ограничения

- Это локальный proxy без собственной авторизации, поэтому по умолчанию он привязан к `127.0.0.1`.
- Не запускайте его на `0.0.0.0`, если не понимаете сетевые последствия.
- Не вставляйте личный Zen API key в README, скриншоты или общий чат.
- Free-модели могут измениться или временно перестать работать на стороне OpenCode Zen.
- Если `npm install` падает с `ENOTFOUND`, проблема обычно в DNS/сети, а не в этом проекте.

---

<a id="english-setup"></a>
## English setup

### What it does

The project starts a local OpenAI-compatible endpoint:

```text
http://127.0.0.1:3000/v1
```

OpenCode Desktop can use it as a `Local Zen Proxy` provider. The proxy forwards requests to:

```text
https://opencode.ai/zen/v1
```

Default auth is `public`, with this free-model pool:

```text
deepseek-v4-flash-free
mimo-v2.5-free
north-mini-code-free
nemotron-3-ultra-free
big-pickle
```

This is not a subscription bypass or guaranteed unlimited access. Free-model availability is controlled by OpenCode Zen.

### Easiest Windows start

Install two prerequisites first:

1. Install OpenCode Desktop: [opencode.ai/download](https://opencode.ai/download) -> Windows x64 Desktop Beta.
2. Install Node.js 18+ from the official site: [nodejs.org/en/download](https://nodejs.org/en/download). The current LTS version is recommended.
3. Download or clone this repository.
4. In PowerShell, enter the project folder:

```powershell
cd C:\project\opencode
```

5. Run the first-time setup:

```powershell
.\run-opencode-proxy.cmd
```

The script configures the already installed OpenCode Desktop, then starts the local proxy. Keep the proxy window open while using OpenCode Desktop.

6. Restart OpenCode Desktop.
7. Pick models from `Local Zen Proxy`.

After the first-time setup, use this daily launcher:

```powershell
.\open-opencode.cmd
```

It checks the proxy, starts it in a separate window if needed, waits for `/health`, and then opens OpenCode Desktop. This is the easiest way to avoid `ECONNREFUSED 127.0.0.1:3000`.

### Factory Droid / Mission / Validation

Factory Droid can also use this proxy as a BYOK/custom OpenAI-compatible model. This is useful when Factory-managed model access is unavailable, but custom models are still allowed.

1. Install Factory Desktop/Droid: [factory.ai/product/desktop](https://factory.ai/product/desktop) or the CLI from [docs.factory.ai](https://docs.factory.ai/cli/getting-started/quickstart).
2. Start the local proxy:

```powershell
.\start-proxy.cmd
```

3. Close Factory Desktop/Droid so it reloads config files after setup.
4. Run:

```powershell
.\setup-factory-droid.cmd
```

The script updates:

- `%USERPROFILE%\.factory\settings.json`;
- `%USERPROFILE%\.factory\factory-settings.json`;
- existing `%USERPROFILE%\.factory\missions\*\model-settings.json` files, if present.

It adds these 4 OpenCode Proxy models:

```text
deepseek-v4-flash-free [OpenCode Proxy]
mimo-v2.5-free [OpenCode Proxy]
north-mini-code-free [OpenCode Proxy]
nemotron-3-ultra-free [OpenCode Proxy]
```

Defaults:

- normal chat: `deepseek-v4-flash-free`;
- Mission worker: `mimo-v2.5-free`;
- Validation worker: `deepseek-v4-flash-free`;
- Mission/Validation reasoning: `none`, to avoid sending extra reasoning parameters to the free OpenAI-compatible endpoint.

Reopen Factory afterwards. Normal chat and Mission should show models with the `[OpenCode Proxy]` suffix.

If an existing Mission still shows an old validation model, check:

```text
%USERPROFILE%\.factory\missions\<mission-id>\model-settings.json
```

Expected values:

```json
{
  "workerModel": "custom:opencode-mimo-v2-5-free",
  "workerReasoningEffort": "none",
  "validationWorkerModel": "custom:opencode-deepseek-v4-flash-free",
  "validationWorkerReasoningEffort": "none"
}
```

Proxy check:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

### Separate setup

If you prefer separate steps:

```powershell
.\install-opencode.cmd
```

This script:

- creates or updates `%USERPROFILE%\.config\opencode\opencode.jsonc`;
- creates a timestamped backup next to the config file;
- adds a `zenproxy` provider;
- installs `@ai-sdk/openai-compatible`;
- sets the default models to `zenproxy/deepseek-v4-flash-free` and `zenproxy/mimo-v2.5-free`.

Then start the proxy:

```powershell
.\start-proxy.cmd
```

Or start the proxy and OpenCode Desktop together:

```powershell
.\open-opencode.cmd
```

### Diagnostics

```powershell
.\doctor.cmd
```

It checks Node.js, `@ai-sdk/openai-compatible`, OpenCode config, default model, `/health`, and `/v1/models`.

Check which free models are actually responding now:

```powershell
.\model-health.cmd
.\model-health.cmd --compact
.\model-health.cmd --json
.\model-health.cmd --fail-on warning
```

Local analytics dashboard:

```text
http://127.0.0.1:3000/dashboard
```

JSON metrics for automation:

```text
http://127.0.0.1:3000/metrics
```

Daily usage history:

```text
http://127.0.0.1:3000/usage?days=7
```

Current observed limits:

```text
http://127.0.0.1:3000/limits
```

The dashboard shows 4 primary models, requests, tokens/minute, average latency, errors, daily usage, and limits. When the upstream returns `Retry-After`, reset headers, or remaining/limit headers, the dashboard displays those values. If the upstream does not return an exact remaining quota, it shows `API не передал` and uses local daily history for observed usage. If the upstream does not return `usage`, the proxy estimates tokens from request/response text length and marks them with the `≈` prefix.

Usage history is written by default to:

```text
%USERPROFILE%\.config\opencode-proxy\usage.jsonl
```

This is a plain JSONL file. It does not store prompts, responses, keys, project paths, or session ids. It stores only technical fields: model, HTTP status, latency, usage tokens, cost, error class, and rate-limit markers.

### Manual run

```bash
npm start
```

Health checks:

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/v1/models
curl http://127.0.0.1:3000/metrics
curl "http://127.0.0.1:3000/usage?days=7"
curl http://127.0.0.1:3000/limits
```

### Config

Environment variables:

| Variable | Default |
|---|---|
| `OPENCODE_ZEN_API_KEY` | `public` |
| `HOST` | `127.0.0.1` |
| `PORT` | `3000` |
| `MODELS` | comma-separated free models |
| `PRIMARY_MODELS` | 4 models for the top dashboard cards |
| `ROUTING` | `round-robin` or `random` |
| `UPSTREAM_URL` | `https://opencode.ai/zen/v1` |
| `UPSTREAM_TIMEOUT` | `30000` ms |
| `METRICS_MAX_EVENTS` | `2000` in-memory events |
| `USAGE_DB_PATH` | `%USERPROFILE%\.config\opencode-proxy\usage.jsonl`; `off` disables the file |
| `USAGE_RETENTION_DAYS` | `30` days for local history |

### How it works

- `GET /health` returns proxy status.
- `GET /dashboard` shows the local dashboard.
- `GET /metrics` returns privacy-safe JSON metrics, primary model status, and daily usage.
- `GET /usage?days=7` returns local usage history by day and model.
- `GET /limits` returns the last observed 429/rate-limit reset by model.
- `GET /v1/models` returns the local model list.
- `POST /v1/chat/completions` accepts an OpenAI-format request and forwards it to OpenCode Zen.
- If `model` is missing, set to `auto`, or not in the local pool, the proxy picks the next model by `round-robin`.
- If `model` is in the pool, the proxy uses that exact model.
- The selected model is returned as the `X-Model-Used` response header.

### Why not Rust

The current version has no npm dependencies: Node.js 18+ is enough, using built-in `http` and `fetch`. Python is not required.

A Rust version is still a good next step for a single `.exe` launcher/doctor, autostart, or tray/service mode. The proxy would still need crates for HTTPS, JSON, and OpenAI-compatible routing; they would just be bundled into the binary.

### Next improvements

- Release zip without binaries: sources, `.cmd`, `.ps1`, README, and tests. This is easier to audit than an unknown `.exe`.
- Protected server fallback through `ssh -L` if local DNS/network access is unstable.
- Dashboard JSON/CSV export for usage reports.
- Cleanup command for old `%USERPROFILE%\.config\opencode-proxy\usage.jsonl` history.
- Calibration for approximate token estimates when the upstream does not return `usage`.
- Optional Rust helper later: launcher/doctor only, not the default install path.

### Risks and limits

- The proxy has no built-in auth, so it binds to `127.0.0.1` by default.
- Do not run it on `0.0.0.0` unless you understand the network exposure.
- Do not paste a personal Zen API key into README files, screenshots, or shared chats.
- Free-model availability is controlled by OpenCode Zen and may change.
- If `npm install` fails with `ENOTFOUND`, it is usually a DNS/network problem.

### Tests

```bash
npm test
```

MIT.
