# Roadmap

This project should stay small, local-first, and safe by default. The goal is to make OpenCode Desktop setup easier for a team without maintaining a full OpenCode fork unless it becomes unavoidable.

## Current scope

- Local OpenAI-compatible proxy for OpenCode Zen free models.
- One-command Windows setup through `run-opencode-proxy.cmd`.
- Daily proxy + Desktop launcher through `open-opencode.cmd`.
- Safe default network binding to `127.0.0.1`.
- Diagnostic checks through `doctor.cmd`.
- Local privacy-safe analytics through `/dashboard` and `/metrics`.
- OpenCode Desktop configuration through a dedicated `zenproxy` provider.

## Useful patterns from nearby projects

From `neurogate-limit-watch`:

- `--json` and `--compact` outputs for automation, widgets, and quick support.
- A no-secret diagnostic flow that checks environment, config, and live health.
- Windows `.cmd` helpers that keep the console open for double-click users.
- Release archives that include helper scripts and examples.

From `abtop`:

- Privacy-safe status summaries that avoid local paths, prompts, session IDs, and chat text.
- Read-only local monitoring first; no API keys for local process/session views.
- Optional JSON snapshots for dashboards without forcing a full UI upfront.

## Phase 1: make sharing painless

- Publish a GitHub release zip with only the files users need.
- Add a short Russian quickstart at the top of the release notes.
- Add screenshots showing the expected `Local Zen Proxy` model picker.
- Add a troubleshooting table for npm DNS failures, missing Node.js, busy port `3000`, and OpenCode config parse errors.
- Keep improving `model-health`, which tests each configured free model and prints which ones are usable today.

## Phase 2: reduce manual runtime work

- Add a background launcher option for Windows.
- Add richer dashboard filters and export options for `http://127.0.0.1:3000/dashboard`.
- Add graceful port fallback, for example `3000 -> 3001 -> 3002`, and update OpenCode config automatically.
- Add a backup/restore command for OpenCode config.
- Add optional Windows startup registration, disabled by default.

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
