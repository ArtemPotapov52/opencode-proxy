# opencode-proxy

OpenAI-compatible local proxy for OpenCode Zen free models. It runs on your machine, exposes `http://127.0.0.1:3000/v1`, and lets OpenCode Desktop use a small free-model pool through a dedicated `Local Zen Proxy` provider.

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

### Быстрая настройка для Windows

Требуется Node.js 18+.

1. Скачайте или клонируйте репозиторий.
2. Запустите:

```powershell
.\install-opencode.cmd
```

Скрипт:

- создаст или обновит `%USERPROFILE%\.config\opencode\opencode.jsonc`;
- сделает бэкап текущего конфига рядом с файлом;
- добавит провайдера `zenproxy`;
- установит пакет `@ai-sdk/openai-compatible`;
- выставит модели `zenproxy/deepseek-v4-flash-free` и `zenproxy/mimo-v2.5-free`.

3. Запустите proxy:

```powershell
.\start-proxy.cmd
```

Окно proxy должно оставаться открытым, пока вы работаете в OpenCode Desktop.

4. Перезапустите OpenCode Desktop.
5. В выборе моделей используйте `Local Zen Proxy`.

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

- `GET /health` показывает статус proxy.
- `GET /v1/models` возвращает локальный список моделей.
- `POST /v1/chat/completions` принимает OpenAI-format запрос и пересылает его в OpenCode Zen.
- Если `model` не указан, равен `auto`, или отсутствует в локальном пуле, proxy выбирает следующую модель по `round-robin`.
- Если `model` есть в пуле, используется именно она.
- Выбранная модель возвращается в заголовке `X-Model-Used`.

### Почему не Rust

Текущая версия уже без npm-зависимостей: только Node.js 18+ и встроенные `http`/`fetch`. Для коллег это проще, чем собирать бинарники.

Rust-версия возможна как следующий этап: один `.exe`, автозапуск и tray/служба. Но для HTTPS, JSON и OpenAI-compatible proxy всё равно понадобятся crates, просто они будут запакованы в бинарник. Практичный первый шаг — автоматическая настройка OpenCode плюс простой запуск proxy.

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

### Quick Windows setup

Requires Node.js 18+.

1. Download or clone this repository.
2. Run:

```powershell
.\install-opencode.cmd
```

The script:

- creates or updates `%USERPROFILE%\.config\opencode\opencode.jsonc`;
- creates a timestamped backup next to the config file;
- adds a `zenproxy` provider;
- installs `@ai-sdk/openai-compatible`;
- sets the default models to `zenproxy/deepseek-v4-flash-free` and `zenproxy/mimo-v2.5-free`.

3. Start the proxy:

```powershell
.\start-proxy.cmd
```

Keep this window open while using OpenCode Desktop.

4. Restart OpenCode Desktop.
5. Pick models from `Local Zen Proxy`.

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
| `PORT` | `3000` |
| `MODELS` | comma-separated free models |
| `ROUTING` | `round-robin` or `random` |
| `UPSTREAM_URL` | `https://opencode.ai/zen/v1` |
| `UPSTREAM_TIMEOUT` | `30000` ms |

### Tests

```bash
npm test
```

MIT.
