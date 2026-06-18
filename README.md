# opencode-proxy

Прокси для OpenCode Zen API с ротацией моделей (round-robin).

## Использование

```bash
export OPENCODE_ZEN_API_KEY=your_key
npm start
```

Прокси слушает на `http://localhost:3000` и принимает запросы в формате OpenAI Chat Completions API.

При каждом запросе модель автоматически выбирается по round-robin из пула (по умолчанию — бесплатные модели Zen).

## Эндпоинты

- `POST /v1/chat/completions` — прокси к OpenCode Zen
- `GET /v1/models` — список доступных моделей
- `GET /health` — проверка статуса

## Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `OPENCODE_ZEN_API_KEY` | — | API ключ OpenCode Zen |
| `PORT` | `3000` | Порт сервера |
| `MODELS` | бесплатные модели | Список моделей через запятую |
| `ROUTING` | `round-robin` | Стратегия: `round-robin` или `random` |
| `UPSTREAM_URL` | `https://opencode.ai/zen/v1` | URL API |

## Тесты

```bash
npm test
```

## Модели по умолчанию

- `big-pickle`
- `deepseek-v4-flash-free`
- `mimo-v2.5-free`
- `north-mini-code-free`
- `nemotron-3-ultra-free`
