# Roadmap

This project should stay small, local-first, and safe by default. The goal is to make OpenCode Desktop setup easier for a team without maintaining a full OpenCode fork unless it becomes unavoidable.

## Current scope

- Local OpenAI-compatible proxy for OpenCode Zen free models.
- One-command Windows setup through `run-opencode-proxy.cmd`.
- Daily proxy + Desktop launcher through `open-opencode.cmd`.
- Safe default network binding to `127.0.0.1`.
- Diagnostic checks through `doctor.cmd`.
- Factory Droid checks through `doctor-factory.cmd`.
- Local privacy-safe analytics through `/dashboard`, `/metrics`, `/usage`, and a JSONL usage log.
- JSON/CSV usage export through `/export/usage.json` and `/export/usage.csv`.
- OpenCode Desktop configuration through a dedicated `zenproxy` provider.
- Source-only release archive builder through `build-release.cmd`.

## Technical debt status after the 2026-06-25 audit

Closed in the hardening pass:

- Bounded request body reads for `POST /v1/chat/completions`.
- Safe handling of request-body stream failures.
- CSV formula injection protection for usage exports.
- SRI pinning for the external Chart.js asset.
- Safer dashboard status rendering without assigning server text through `innerHTML`.
- Optional Basic/Bearer auth for management endpoints through `MANAGEMENT_TOKEN`.
- Management endpoints closed automatically when `HOST` is exposed without a token.
- Structured JSON access logs, disabled with `ACCESS_LOG=off`.
- Async queued usage appends with `flush()` for shutdown and tests.
- Graceful `SIGINT`/`SIGTERM` shutdown with usage flush.
- Config normalization for ports, timeouts, routing, upstream URLs, body limits, and shutdown timeout.
- `proxy-status` CLI inspired by `neurogate-limit-watch`: human, JSON, compact, and `--fail-on` output from `/metrics`.

Remaining debt, in recommended order:

1. Make usage summaries fully async or cache-backed so `/metrics` never does sync tail reads on large files.
2. Split `src/proxy.js` into small route handlers for management, OpenAI-compatible API, exports, and shared response helpers.
3. Split `src/dashboard.js` into static HTML/CSS/JS assets or a tiny no-build asset layout.
4. Remove inline dashboard script/style so Content Security Policy can drop `'unsafe-inline'`.
5. Add request schema validation for `/v1/chat/completions`.

## Development plan

### Phase A: reliability foundation

- Finish async/cache-backed usage reads.
- Add upstream health polling and a small circuit-breaker state per model.
- Add retry with bounded exponential backoff for transient `429` and `5xx` responses.
- Keep failover conservative: try the next configured model only when the request is safe to retry.

### Phase B: observability

- Add `/metrics/prometheus` for local Prometheus-compatible scraping.
- Track latency percentiles per model, not only averages and max.
- Add optional alert webhook for repeated `5xx`, timeout, or rate-limit spikes.
- Add more `--json` snapshots to the launcher/doctor scripts where automation needs stable output.

### Phase C: security hardening

- Add configurable CORS origins; keep deny-by-default for browsers outside same-origin.
- Remove dashboard inline JS/CSS and tighten CSP.
- Add optional request allowlist for remote deployments.
- Document a supported `ssh -L` pattern instead of encouraging direct LAN exposure.

### Phase D: packaging and operations

- Add CI for `npm test`, secret scan, and source-only release archive validation.
- Add optional `.env` loading for local Windows users without requiring a package dependency.
- Add graceful port fallback `3000 -> 3001 -> 3002` and update generated OpenCode config.
- Add an optional Windows startup registration flow, disabled by default.

## Useful patterns from nearby projects

From a local limit-watch side project:

- `--json` and `--compact` outputs for automation, widgets, and quick support.
- A no-secret diagnostic flow that checks environment, config, and live health.
- Windows `.cmd` helpers that keep the console open for double-click users.
- Release archives that include helper scripts and examples.

From `abtop`:

- Privacy-safe status summaries that avoid local paths, prompts, session IDs, and chat text.
- Read-only local monitoring first; no API keys for local process/session views.
- Optional JSON snapshots for dashboards without forcing a full UI upfront.

## Phase 1: make sharing painless

- Keep the GitHub release zip source-only, with only the files users need.
- Keep `QUICKSTART_RU.md` short enough for non-developer colleagues.
- Add screenshots showing the expected `Local Zen Proxy` model picker.
- Add a troubleshooting table for npm DNS failures, missing Node.js, busy port `3000`, and OpenCode config parse errors.
- Keep improving `model-health`, which tests each configured free model and prints which ones are usable today.

## Phase 2: reduce manual runtime work

- Add a background launcher option for Windows.
- Add dashboard filters and comparison views for `http://127.0.0.1:3000/dashboard`.
- Add optional automatic cleanup scheduling for `%USERPROFILE%\.config\opencode-proxy\usage.jsonl`.
- Add graceful port fallback, for example `3000 -> 3001 -> 3002`, and update OpenCode config automatically.
- Add a backup/restore command for OpenCode config.
- Add optional Windows startup registration, disabled by default.

## Phase 2.5: optional Rust helper

Do not rewrite the working proxy first. Start with a small Rust helper that keeps the same files and HTTP endpoints:

- single `opencode-proxy-doctor.exe` for Node/OpenCode/proxy checks;
- optional launcher that starts Node proxy and OpenCode Desktop;
- JSON output compatible with `doctor.cmd` and `/usage`;
- reader for the existing `usage.jsonl`, so no data migration is needed.

This gives colleagues a predictable `.exe` surface without forcing a full proxy rewrite while the OpenCode integration is still moving.

## Phase 3: improve safety

- Keep localhost-only binding by default.
- Add an optional local proxy token for users who intentionally expose the proxy beyond localhost.
- Redact keys in logs and diagnostics.
- Add a clear warning when `HOST=0.0.0.0`.
- Add tests for config backup, restore, and malformed JSONC.

## Phase 4: upstream-first OpenCode integration

Prefer upstream contributions over a long-lived OpenCode fork:

- Propose an OpenCode docs PR for local OpenAI-compatible provider setup.
- Propose a small Desktop onboarding improvement for custom provider base URL setup.
- Propose a provider diagnostics view if OpenCode maintainers are open to it.

## When to fork OpenCode itself

Fork OpenCode only if at least one of these becomes true:

- OpenCode cannot load this provider reliably through supported config.
- The Desktop UX requires changes that cannot be implemented as docs, scripts, plugin, or upstream PR.
- The team needs a branded internal build with preconfigured local provider, update channel, and installer.

If a fork is created, keep the patch set narrow:

- provider onboarding;
- local proxy detection;
- safer model-picker defaults;
- internal branding/disclaimer;
- no changes to paid-provider behavior or upstream auth flow.

## Why not fork OpenCode now

OpenCode is a large, active upstream project. A long-lived fork means tracking frequent releases, Desktop build changes, security fixes, package signing, updater behavior, and upstream config changes. The current proxy fork solves the team setup problem with far less maintenance.
