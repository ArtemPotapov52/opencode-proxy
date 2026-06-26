# 🌐 OpenCode Proxy

<p align="center">
  <a href="https://github.com/xodapi/opencode-proxy"><img src="https://img.shields.io/github/stars/xodapi/opencode-proxy?style=flat-square&logo=github&color=yellow" alt="Stars"></a>
  <a href="https://github.com/xodapi/opencode-proxy/blob/main/LICENSE"><img src="https://img.shields.io/github/license/xodapi/opencode-proxy?style=flat-square&logo=github&color=blue" alt="License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D%2018.0.0-green?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey?style=flat-square&logo=windows" alt="Platform Support">
  <img src="https://img.shields.io/badge/tests-87%20passing-brightgreen?style=flat-square&logo=jest" alt="Tests Status">
  <img src="https://img.shields.io/badge/code%20style-standard-brightgreen?style=flat-square&logo=javascript" alt="Code Style">
</p>

---

## 🇷🇺 Руководство пользователя (Russian Setup)

**OpenCode Proxy** — это легковесный локальный прокси-сервер для бесплатного пула моделей OpenCode Zen без внешних зависимостей. Он работает на локальном компьютере, по умолчанию слушает порт `127.0.0.1:3000` и предоставляет OpenAI-совместимый интерфейс. Это позволяет бесшовно использовать качественные бесплатные модели в **OpenCode Desktop** и **Factory Droid** (для Missions и Validation).

> [!IMPORTANT]
> Данный проект является независимой разработкой сообщества. Он не связан с официальной командой OpenCode, не спонсируется и не поддерживается ими. Доступность бесплатных моделей полностью контролируется апстримом OpenCode Zen.

---

### ✨ Ключевые особенности

- **⚡ Без внешних зависимостей**: Написан исключительно на стандартной библиотеке Node.js (никаких `node_modules` или сложных настроек Python).
- **🔀 Умная балансировка (Routing)**: Автоматическое переключение моделей по стратегиям `round-robin` (циклический перебор) или `random` (случайный выбор), если запрошенная модель перегружена или недоступна.
- **⏱️ Адаптивный пинг лимитов (Probing)**: Интеллектуальный фоновый опрос моделей. Если до сброса лимита 429 осталось более 10 минут, частота проверки снижается до 30 минут, предотвращая агрессивный спам апстрима.
- **📊 Настройка наблюдаемых моделей**: Выбор отображаемых карточек моделей на лету через вкладку настроек дашборда (сохраняется в `localStorage` вашего браузера).
- **🔔 Десктопные уведомления**: Всплывающие оповещения на рабочем столе, когда заблокированная модель снова становится доступной или при ухудшении здоровья прокси.
- **🛡️ Безопасность и конфиденциальность**: Тексты промптов, ответы моделей, локальные пути проектов, API-ключи и сессии никогда не логируются и не сохраняются на диск.

---

### 📁 Карта скриптов репозитория (CLI Scripts Map)

В корне репозитория находятся готовые исполняемые файлы автоматизации (`.cmd` для Windows), упрощающие установку, запуск и диагностику:

#### 🚀 Запуск и Установка
| Скрипт | Описание |
|---|---|
| [`.\run-opencode-proxy.cmd`](run-opencode-proxy.cmd) | **Первичная настройка**: Автоматически регистрирует провайдер в OpenCode Desktop и запускает локальный прокси. |
| [`.\open-opencode.cmd`](open-opencode.cmd) | **Ежедневный лаунчер**: Проверяет, запущен ли прокси (запускает при необходимости) и открывает OpenCode Desktop. |
| [`.\start-proxy.cmd`](start-proxy.cmd) | **Автономный запуск**: Запускает прокси-сервер в фоновом консольном окне. |
| [`.\install-opencode.cmd`](install-opencode.cmd) | Отдельный скрипт для интеграции расширения `@ai-sdk/openai-compatible` в OpenCode Desktop. |

#### 🛠️ Инструменты Factory Droid
| Скрипт | Описание |
|---|---|
| [`.\setup-factory-droid.cmd`](setup-factory-droid.cmd) | Прописывает кастомные модели OpenCode Proxy в конфигурационные файлы Factory Droid. |
| [`.\doctor-factory.cmd`](doctor-factory.cmd) | Диагностика конфигурации Factory Droid, активных миссий и моделей валидации. |
| [`.\factory-settings-backup.cmd`](factory-settings-backup.cmd) | Создание локальных бэкапов и откат изменений в конфигурационных файлах Factory Droid. |
| [`.\update-vibemode-factory.cmd`](update-vibemode-factory.cmd) | Миграция устаревших конфигураций NeuroGate на новый URL-адрес VibeMode. |

#### 🩺 Диагностика и Аналитика
| Скрипт | Описание |
|---|---|
| [`.\doctor.cmd`](doctor.cmd) | Проверка окружения Node.js, синтаксиса конфигурации OpenCode, доступности сети и эндпоинтов прокси. |
| [`.\model-health.cmd`](model-health.cmd) | Сканирование реального статуса доступности и ошибок всех бесплатных моделей в пуле. |
| [`.\proxy-status.cmd`](proxy-status.cmd) | Вывод компактной сводки метрик работы прокси (запросы, лимиты, задержки) прямо в терминал. |
| [`.\cleanup-usage.cmd`](cleanup-usage.cmd) | Очистка истории использования и файлов базы данных `usage.jsonl`. |
| [`.\secret-scan.cmd`](secret-scan.cmd) | Проверка локальных файлов на утечку API-ключей, токенов или персональных данных. |
| [`.\build-release.cmd`](build-release.cmd) | Сборка чистого ZIP-архива исходных кодов релиза. |

---

### 🚀 Быстрый старт (Windows)

1. Установите **OpenCode Desktop**: [opencode.ai/download](https://opencode.ai/download) -> Windows x64 Desktop Beta.
2. Установите **Node.js 18+** с официального сайта [nodejs.org](https://nodejs.org/).
3. Скачайте или клонируйте этот репозиторий.
4. Откройте PowerShell в папке проекта и запустите первоначальную настройку:
   ```powershell
   .\run-opencode-proxy.cmd
   ```
   Скрипт автоматически пропишет новый локальный провайдер в конфиг OpenCode Desktop и запустит прокси.
5. Перезапустите OpenCode Desktop и выберите в моделях провайдер `Local Zen Proxy`.

Для ежедневного использования запускайте прокси и редактор одной командой:
```powershell
.\open-opencode.cmd
```

Панель мониторинга (Dashboard) доступна по адресу:  
👉 **`http://127.0.0.1:3000/dashboard`**

---

### 🔌 Интеграция с Factory Droid (Missions & Validation)

Вы можете перенаправить запросы Factory Droid через этот прокси (например, если закончилась подписка на встроенные модели Factory Droid, но разрешено использование custom-моделей).

1. Запустите прокси:
   ```powershell
   .\start-proxy.cmd
   ```
2. Выполните скрипт автонастройки:
   ```powershell
   .\setup-factory-droid.cmd
   ```
   Скрипт обновит конфигурации в `%USERPROFILE%\.factory\` и пропишет модели с суффиксом `[OpenCode Proxy]`.
3. Для проверки интеграции с Factory Droid запустите диагностику:
   ```powershell
   .\doctor-factory.cmd
   ```

---

### ⚙️ Справочник переменных окружения (Configuration)

Настройка прокси осуществляется через переменные окружения или файл `.env` в корневой папке.

| Переменная | По умолчанию | Описание |
|---|---|---|
| `OPENCODE_ZEN_API_KEY` | `public` | API-ключ для авторизации в апстрим API OpenCode Zen. |
| `HOST` | `127.0.0.1` | Сетевой интерфейс, который слушает прокси-сервер. |
| `PORT` | `3000` | Сетевой порт прокси-сервера. |
| `MODELS` | *Список free-моделей* | Доступные модели в локальном пуле через запятую. |
| `PRIMARY_MODELS` | *Основные 4 модели*| Модели, отображаемые на верхних карточках дашборда. |
| `ROUTING` | `round-robin` | Стратегия балансировки нагрузки: `round-robin` или `random`. |
| `UPSTREAM_URL` | `https://opencode.ai/zen/v1` | URL-адрес оригинального API OpenCode Zen. |
| `UPSTREAM_TIMEOUT` | `30000` (мс) | Таймаут ожидания ответа от апстрима. |
| `MAX_BODY_BYTES` | `2097152` (2МБ) | Максимальный размер тела запроса к прокси. |
| `USAGE_DB_PATH` | *Папка конфига пользователя*| Путь к файлу `usage.jsonl` для сохранения истории. `off` отключает запись на диск. |
| `USAGE_RETENTION_DAYS`| `30` | Количество дней хранения локальной истории использования. |
| `MANAGEMENT_TOKEN` | *Пусто* | Токен для защиты дашборда и метрик при бинде вне localhost. |
| `PROBE_INTERVAL` | `30000` (мс) | Интервал проверки состояния заблокированных моделей. `0` отключает опрос. |

---

### 💻 Руководство разработчика

#### Запуск автотестов
Запуск тестов на встроенном Node.js Test Runner:
```bash
npm test
```

#### Проверки качества кода
Запуск сканера секретов и проверка форматирования:
```powershell
npm run secret-scan
git diff --check
```

---

## 🇬🇧 English User Guide

**OpenCode Proxy** is a lightweight, zero-dependency, OpenAI-compatible local proxy for the OpenCode Zen free models pool. It listens on `127.0.0.1:3000` by default and exposes an OpenAI-compatible endpoint. This enables **OpenCode Desktop** and **Factory Droid** to utilize a small, free model pool via custom provider settings.

---

### ✨ Core Features

- **⚡ Zero External Dependencies**: Powered entirely by the Node.js standard library.
- **🔀 Smart Routing**: Auto-fallbacks via `round-robin` or `random` strategies if a requested model is throttled or offline.
- **⏱️ Adaptive Probing**: Automatically pings throttled models. If a rate-limit reset is more than 10 minutes away, the probe interval decreases to 30 minutes.
- **📊 Dashboard Customization**: Toggle visible models on the dashboard cards via browser-side settings (saved in `localStorage`).
- **🔔 Desktop Notifications**: Local desktop alerts trigger whenever a rate-limited model becomes available or proxy health degrades.
- **🛡️ Privacy-Preserving**: Prompts, responses, local file paths, API keys, and session IDs are never saved to disk.

---

### 📁 CLI Script Directory

#### 🚀 Launchers & Installers
- [`.\run-opencode-proxy.cmd`](run-opencode-proxy.cmd) — **First-Time Setup**: Configures OpenCode Desktop and boots up the local proxy.
- [`.\open-opencode.cmd`](open-opencode.cmd) — **Daily Launcher**: Verifies if the proxy is running and opens OpenCode Desktop.
- [`.\start-proxy.cmd`](start-proxy.cmd) — **Autonomous Run**: Starts the proxy standalone in a background/console window.
- [`.\install-opencode.cmd`](install-opencode.cmd) — Automated script to install `@ai-sdk/openai-compatible` extensions to OpenCode Desktop.

#### 🛠️ Factory Droid Tools
- [`.\setup-factory-droid.cmd`](setup-factory-droid.cmd) — Configures custom OpenCode models inside the Factory Droid settings folder.
- [`.\doctor-factory.cmd`](doctor-factory.cmd) — Validates Factory Droid settings, active missions, and validation models.
- [`.\factory-settings-backup.cmd`](factory-settings-backup.cmd) — Creates local settings backups/rollbacks for Factory Droid configuration files.
- [`.\update-vibemode-factory.cmd`](update-vibemode-factory.cmd) — Migrates legacy NeuroGate configurations to the new VibeMode endpoint.

#### 🩺 Diagnostics & Utilities
- [`.\doctor.cmd`](doctor.cmd) — Runs checkups on Node.js, OpenCode config syntax, health checks, and models.
- [`.\model-health.cmd`](model-health.cmd) — Verifies the real-time availability of all upstream free models.
- [`.\proxy-status.cmd`](proxy-status.cmd) — Prints a compact CLI summary of requests, active rate limits, and latency.
- [`.\cleanup-usage.cmd`](cleanup-usage.cmd) — Prunes local RAM-logs or `usage.jsonl` database files.
- [`.\secret-scan.cmd`](secret-scan.cmd) — Audits files for raw API keys, passwords, or configuration secrets.
- [`.\build-release.cmd`](build-release.cmd) — Builds a source-only clean release `.zip` bundle.

---

### 🚀 Quick Start (Windows)

1. Install **OpenCode Desktop**: [opencode.ai/download](https://opencode.ai/download) -> Windows x64 Desktop Beta.
2. Install **Node.js 18+** from [nodejs.org](https://nodejs.org/).
3. Download or clone this repository.
4. Run the first-time setup in PowerShell:
   ```powershell
   .\run-opencode-proxy.cmd
   ```
5. Restart OpenCode Desktop and select `Local Zen Proxy`.

Daily launcher command:
```powershell
.\open-opencode.cmd
```

Dashboard URL:  
👉 **`http://127.0.0.1:3000/dashboard`**

---

### 🔌 Factory Droid Integration

1. Start the proxy:
   ```powershell
   .\start-proxy.cmd
   ```
2. Configure Factory settings:
   ```powershell
   .\setup-factory-droid.cmd
   ```
3. Run verification:
   ```powershell
   .\doctor-factory.cmd
   ```

---

### ⚙️ Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `OPENCODE_ZEN_API_KEY` | `public` | Auth key for the upstream OpenCode Zen API. |
| `HOST` | `127.0.0.1` | Network host to bind the proxy server. |
| `PORT` | `3000` | Port to run the proxy server on. |
| `MODELS` | *Default free pool* | Comma-separated models pool. |
| `PRIMARY_MODELS` | *Top 4 models* | Selected models displayed as top dashboard cards. |
| `ROUTING` | `round-robin` | Load balancing strategy: `round-robin` or `random`. |
| `UPSTREAM_URL` | `https://opencode.ai/zen/v1` | Upstream API endpoint. |
| `UPSTREAM_TIMEOUT` | `30000` (ms) | Requests timeout limit. |
| `MAX_BODY_BYTES` | `2097152` (2MB) | Max allowed body payload size. |
| `USAGE_DB_PATH` | *User config folder* | JSONL storage path for usage statistics. Set to `off` to disable. |
| `USAGE_RETENTION_DAYS`| `30` | Prune records older than this duration from usage logs. |
| `MANAGEMENT_TOKEN` | *Empty* | Token to restrict `/dashboard`, `/flow`, `/metrics` etc. |
| `PROBE_INTERVAL` | `30000` (ms) | Rate limit checking frequency. Set to `0` to disable. |

---

### 💻 Developer Guide

#### Run Tests
```bash
npm test
```

#### Run Checks
```powershell
npm run secret-scan
git diff --check
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
