# Release Checklist

Перед тем как отправлять архив коллегам:

```powershell
npm test
npm run secret-scan
.\start-proxy.cmd
.\doctor.cmd
.\doctor-factory.cmd
.\model-health.cmd --compact
.\proxy-status.cmd --compact
Invoke-RestMethod http://127.0.0.1:3000/health
.\build-release.cmd
```

Архив в `dist\opencode-proxy-release.zip` должен содержать только README, quickstart, `.cmd`, `.ps1`, `src`, `scripts`, `tests`, `package.json` и примеры. В нем не должно быть `.exe`, `.dll`, `.msi`, `.env`, `.factory`, `node_modules` или платных API-ключей.

Для ручной очистки локальной истории статистики:

```powershell
.\cleanup-usage.cmd --days 30
```

Для выгрузки dashboard-статистики:

```text
http://127.0.0.1:3000/export/usage.json?days=7
http://127.0.0.1:3000/export/usage.csv?days=7
```

Резервный доступ через SSH tunnel, если proxy запущен на другой доверенной машине:

```powershell
ssh -N -L 3001:127.0.0.1:3000 stroy
```

Тогда резервный OpenAI-compatible endpoint:

```text
http://127.0.0.1:3001/v1
```
