# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); this project uses semantic versioning.

## [2.3.0] — 2026-08-12

### Added
- **One-click setup**: the first-run guide now has an **Install now** button
  (runs `npm install -g @anthropic-ai/claude-code` for you, with status
  feedback) and a **Sign in** button (opens a terminal running
  `claude /login`; the account card appears automatically once OAuth
  completes). The CLI is auto-detected — an installed CLI shows a green
  check with its version.
- New IPC surface `claude-setup-check` / `claude-setup-install` /
  `claude-setup-login` backed by `src/main/claude-setup.ts`. All commands are
  fixed argv — no user input ever reaches a shell.
- Windows note: the login terminal uses `cmd.exe` deliberately — PowerShell
  resolves the npm shim to `claude.ps1`, which ExecutionPolicy blocks on many
  machines; `cmd` resolves `claude.cmd` and always works.

## [2.2.0] — 2026-08-12

First-run reliability release — fixes the "installed it and nothing shows up" trap.

### Fixed
- **CLI logins are now re-detected on every launch** (and merged into the account
  list). Previously detection ran only on the very first launch and persisted the
  result — installing the app *before* logging into Claude Code left the account
  list permanently empty, even after `/login`. This was the root cause of
  "not working when installed" reports.
- Removing an auto-detected account is remembered (it won't resurrect on the next
  launch); re-adding it or pressing **Scan for accounts** clears the opt-out.
- `'throttled'` was missing from the fetch-error code union, silently dead-typing
  the throttle-handling branch (latent, now typed).

### Added
- **In-app first-run setup guide**: the empty state now walks through
  `npm install -g @anthropic-ai/claude-code` → `claude` → `/login`, with a
  **Scan for accounts** button; the app also auto-rescans every 10 s while the
  account list is empty, so the card appears moments after login — no restart.
- **Actionable error hints** on account cards: missing/expired Claude or Codex
  credentials now show the exact commands to run (`claude` + `/login`,
  `codex login`) instead of just the raw error.
- **Renderer Content-Security-Policy** — everything locked to `'self'`; the
  renderer performs no direct network requests (all provider calls go through
  the main process over IPC).
- `npm run typecheck`, wired as a `prepackage` gate so packaging always ships a
  freshly typechecked + rebuilt bundle.

### Changed
- Installer and portable artifacts now have distinct names
  (`Usage Tracker-Setup-…` / `Usage Tracker-Portable-…`) — they previously
  overwrote each other.
- Proper multi-resolution app icon (the old `icon.ico` was 16×16, which
  electron-builder rejects).
- README: consumer install path, 2-minute Claude Code OAuth setup, and a
  troubleshooting table.

## [2.1.0] — 2026-06-09

### Added
- **Dashboard revamp** (polished cards): provider marks, credential-type chips, status-colored
  accent per card, refined session/weekly bars with reset countdowns.
- **Overall status summary** strip: account count, most-constrained account, health dot,
  last-updated, and a Refresh-all button.
- **Per-account refresh** button on each card.
- **Usage history sparkline** per account (in-memory recent session% trend).
- Overlay opacity is now actually applied (window.setOpacity) and adjustable live.
- Tray icon click (and a second app launch) now shows the dashboard.

### Fixed
- **App now fully quits** from the tray (was hiding to tray instead of exiting).
- **Stuck in overlay mode** — the main/renderer overlay flags could desync (toggle recreated
  the window before persisting), trapping the user with no expand button; ordering fixed and the
  overlay expand button + tray "Show Dashboard" now reliably return to the desktop window.
- The whole overlay card is draggable (was only the thin header).
- Persisted settings (overlay mode, opacity, interval, thresholds, theme) are restored on launch
  again; the main store now loads synchronously so startup reads see the saved values.
- Click-through overlay uses `{ forward: true }` so hover-to-interact works.

## [2.0.0] — 2026-06-09

Multi-provider revamp. The ZAI-only monitor is now a general coding-plan usage
tracker. The usage-tracking engine was extracted and generalized from
[Aperant](https://github.com/AndyMik90/Aperant).

### Added
- **Provider registry** (`src/main/providers/`) — declarative catalog of providers,
  each normalized to one `{ sessionPercent, weeklyPercent, resets }` shape.
- **Live providers**: Claude Code (`anthropic`), Z.AI GLM (`zai`), Zhipu (`zhipu`),
  OpenAI Codex (`openai`).
- **Scaffolded providers** (picker entries, no fabricated endpoints): DeepSeek, Kimi,
  Qwen, MiniMax, OpenCode.
- **Local-login auto-detection** — reads the OAuth token the Claude Code / Codex CLI
  already stored (`~/.claude`, `~/.codex`); no key to paste.
- **Claude token auto-refresh** — refreshes the expired OAuth token via the Claude Code
  refresh grant and writes the rotated tokens back to `~/.claude/.credentials.json`
  atomically (one-time `.bak` backup), keeping the CLI in sync.
- **Rate-limit handling** — per-provider minimum poll interval (Claude/Codex = 60s) and a
  5-minute cooldown on HTTP 429 that serves the last good snapshot.
- **Multi-account UI** — `AccountsView` / `AccountCard` / `AccountsManager`; track several
  providers at once, each as its own card. New IPC: `fetch-account-usage`,
  `list-providers`, `discover-local-accounts`.
- **Playwright Electron E2E** (`e2e/app.spec.ts`, `npm run test:e2e`).
- Docs: rewritten README, this changelog, and `docs/PROVIDERS.md`.

### Changed
- Repository renamed `zai-glm-usage-monitor` → **`Usage-Tracker`**.
- Legacy `fetch-usage(apiKey, baseUrl)` now provider-detects and routes through the engine.
- `package.json` name → `usage-tracker`.

### Fixed
- Claude usage returned `401` (expired token) / `429` (over-polling) — both resolved by the
  auto-refresh + rate-limit handling above.
- **Accessibility**: removed `aria-hidden="true"` from the settings backdrop, which had
  hidden the entire modal (heading, controls) from the accessibility tree / screen readers.

### Removed
- Orphaned single-account modules: `api-service.ts`, `UsageDisplay.tsx`, `useUsageData.ts`.

## [1.0.0]

- Initial ZAI/GLM usage monitor: Electron + React + TypeScript, system tray, Windows
  taskbar overlay with percentage badge, multi-theme support (14 combinations),
  configurable alerts, Windows packaging.
