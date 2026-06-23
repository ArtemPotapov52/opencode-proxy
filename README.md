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

Требуется Node.js 18+.

1. Скачайте или клонируйте репозиторий.
2. Запустите:

```powershell
.\run-opencode-proxy.cmd
```

Скрипт сначала настроит OpenCode Desktop, потом запустит локальный proxy. Окно proxy должно оставаться открытым, пока вы работаете в OpenCode Desktop.

3. Перезапустите OpenCode Desktop.
4. В выборе моделей используйте `Local Zen Proxy`.

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
```

### Ручной запуск

```powershell
npm start
```

Проверка:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/v1/models
```

### Конфиг

Переменные окружения:

| Переменная | По умолчанию |
|---|---|
| `OPENCODE_ZEN_API_KEY` | `public` |
| `HOST` | `127.0.0.1` |
| `PORT` | `3000` |
| `MODELS` | free-модели через запятую |
| `ROUTING` | `round-robin` или `random` |
| `UPSTREAM_URL` | `https://opencode.ai/zen/v1` |
| `UPSTREAM_TIMEOUT` | `30000` мс |

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
- `GET /v1/models` возвращает локальный список моделей.
- `POST /v1/chat/completions` принимает OpenAI-format запрос и пересылает его в OpenCode Zen.
- Если `model` не указан, равен `auto`, или отсутствует в локальном пуле, proxy выбирает следующую модель по `round-robin`.
- Если `model` есть в пуле, используется именно она.
- Выбранная модель возвращается в заголовке `X-Model-Used`.

### Почему не Rust

Текущая версия уже без npm-зависимостей: только Node.js 18+ и встроенные `http`/`fetch`. Для коллег это проще, чем собирать бинарники.

Rust-версия возможна как следующий этап: один `.exe`, автозапуск и tray/служба. Но для HTTPS, JSON и OpenAI-compatible proxy всё равно понадобятся crates, просто они будут запакованы в бинарник. Практичный первый шаг — автоматическая настройка OpenCode плюс простой запуск proxy.

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

Requires Node.js 18+.

1. Download or clone this repository.
2. Run:

```powershell
.\run-opencode-proxy.cmd
```

The script configures OpenCode Desktop first, then starts the local proxy. Keep the proxy window open while using OpenCode Desktop.

3. Restart OpenCode Desktop.
4. Pick models from `Local Zen Proxy`.

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
```

### Manual run

```bash
npm start
```

Health checks:

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/v1/models
```

### Config

Environment variables:

| Variable | Default |
|---|---|
| `OPENCODE_ZEN_API_KEY` | `public` |
| `HOST` | `127.0.0.1` |
| `PORT` | `3000` |
| `MODELS` | comma-separated free models |
| `ROUTING` | `round-robin` or `random` |
| `UPSTREAM_URL` | `https://opencode.ai/zen/v1` |
| `UPSTREAM_TIMEOUT` | `30000` ms |

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
