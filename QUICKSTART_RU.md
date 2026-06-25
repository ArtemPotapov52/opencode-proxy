# Быстрый старт для Windows

Короткий путь для коллег: без `.exe`, без бинарников, только Node.js, `.cmd`, исходники и локальный proxy на `127.0.0.1`.

## 1. Установить Node.js

Установите Node.js 18+ с официального сайта:

```text
https://nodejs.org/en/download
```

После установки откройте новый PowerShell и проверьте:

```powershell
node --version
npm --version
```

## 2. Установить OpenCode или Factory Droid

OpenCode Desktop:

```text
https://opencode.ai/download
```

Factory Desktop/Droid:

```text
https://factory.ai/product/desktop
```

## 3. Запустить локальный proxy

В папке проекта выполните:

```powershell
.\start-proxy.cmd
```

Окно proxy должно оставаться открытым. В нем должно быть видно:

```text
OpenCode Proxy running on http://127.0.0.1:3000
```

## 4. Настроить OpenCode Desktop

В отдельном PowerShell:

```powershell
.\install-opencode.cmd
.\doctor.cmd
```

Если `doctor.cmd` зеленый, перезапустите OpenCode Desktop и выбирайте модели через `Local Zen Proxy`.

## 5. Настроить Factory Droid

Закройте Factory Desktop/Droid и выполните:

```powershell
.\setup-factory-droid.cmd
.\doctor-factory.cmd
```

Doctor проверит `.factory\settings.json`, custom OpenCode-модели, Mission/Validation и старые `missions\*\model-settings.json`.

## 6. Проверить dashboard

Откройте:

```text
http://127.0.0.1:3000/dashboard
```

Быстрые проверки:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
.\model-health.cmd --compact
```

Dashboard хранит только техническую статистику: модель, статус, задержку, токены, cost и класс ошибки. Промпты, ответы и ключи не сохраняются.
