# Usage Tracker

> **Real-time coding-plan usage monitoring across providers — never hit a rate limit unexpectedly again**

[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)](README.md)
[![Electron](https://img.shields.io/badge/Electron-32-blue?style=flat-square)](https://www.electronjs.org/)

A lightweight desktop app that tracks your **coding-plan usage across multiple providers** — Claude Code, Z.AI / GLM, Zhipu, and OpenAI Codex — side by side, in real time. It runs in your system tray with color-coded status, a taskbar overlay, and desktop alerts before you hit a limit.

Each provider is normalized to one shape — a short **session** window and a longer **weekly/monthly** window, as percentages — so a Claude card and a GLM card sit next to each other and read the same way.

> Originated from the [Aperant](https://github.com/AndyMik90/Aperant) project (formerly "Auto-Claude") — the usage-tracking engine was extracted and generalized into this standalone multi-provider tracker.

---

## ✨ Features

- **Multi-provider, multi-account** — track Claude Code, Z.AI/GLM, Zhipu, and Codex simultaneously, each as its own card.
- **Zero-config local logins** — for Claude Code and Codex it auto-reads the OAuth token their CLI already stored on your machine (no key to paste). Claude tokens are **auto-refreshed** when they expire.
- **API-key providers** — Z.AI / Zhipu (and other API-key plans) added with a key + base URL.
- **Smart rate-limit handling** — per-provider minimum poll interval and a cooldown that serves the last good snapshot instead of hammering an endpoint (Claude/Codex usage endpoints are sensitive to frequent polling).
- **System tray + taskbar overlay** — color-coded status and a percentage badge for the most-constrained account.
- **Alerts** — desktop notifications at configurable thresholds (80 / 90 / 100%).
- **Multi-theme** — 10 themes × light/dark.
- **Accessible** — keyboard navigation, screen-reader-friendly dialogs.

---

## 🔌 Supported providers

| Provider | Credential | Usage endpoint | Status |
|----------|-----------|----------------|--------|
| **Claude Code** (`anthropic`) | Local OAuth token (`~/.claude`), auto-refreshed | `api.anthropic.com/api/oauth/usage` | ✅ Live |
| **Z.AI GLM** (`zai`) | API key | `…/api/monitor/usage/quota/limit` | ✅ Live |
| **Zhipu / BigModel** (`zhipu`) | API key | `…/api/monitor/usage/quota/limit` | ✅ Live |
| **OpenAI Codex** (`openai`) | Local OAuth token (`~/.codex`) | `chatgpt.com/backend-api/wham/usage` | ✅ Live |
| DeepSeek, Kimi | API key | balance API only | 🟡 Scaffolded |
| Qwen, MiniMax, OpenCode | — | no public usage window | 🟡 Scaffolded |

**Scaffolded** providers appear in the picker but return a clear "not wired yet" message — we deliberately don't invent endpoints that don't exist. Adding one later is a single registry entry (+ a normalizer if its response shape is new). See [docs/PROVIDERS.md](docs/PROVIDERS.md).

---

## 🚀 Quick Start

### Option A — Install the app (recommended)

1. Download **`Usage Tracker-Setup-<version>-x64.exe`** from [Releases](https://github.com/Hermbot14/claude-code-usage-tracker/releases) (or build it yourself, below) and run it.
   > Windows SmartScreen may warn because the build is unsigned — click **More info → Run anyway**.
2. Launch **Usage Tracker** from the Start menu or desktop shortcut.

A portable build (`Usage Tracker-Portable-<version>-x64.exe`, no install needed) is also produced.

### First-time setup — connect Claude Code (2 minutes)

Usage Tracker reads the OAuth login your **Claude Code CLI** already has. No API key to paste — and the app walks you through it with **one-click buttons** on the home screen:

1. **Install now** — installs the Claude Code CLI for you (`npm install -g @anthropic-ai/claude-code`). If it's already installed you'll see a green check instead.
2. **Sign in** — opens a terminal running `claude /login`; finish signing in via your browser.

**That's it.** Usage Tracker detects the login automatically — your account card appears within a few seconds (the app rescans every 10 s while empty; there's also a **Scan for accounts** button). It works in either order: install the app before or after logging in.

Prefer the terminal? The same steps by hand:

```bash
npm install -g @anthropic-ai/claude-code
claude          # then type /login and finish in the browser
```

Other providers:
- **OpenAI Codex** — run `codex login`; detected the same way.
- **Z.AI / Zhipu** — Settings → Accounts → pick the provider → paste your API key (base URL is pre-filled).

#### Troubleshooting

| Symptom | Fix |
|---------|-----|
| "No Claude Code credentials found" | You're not logged in (or logged out). Run `claude`, type `/login`, sign in, then hit **Refresh** on the card. |
| Card shows an auth error after weeks of use | Your refresh token expired. Same fix: `claude` → `/login`. |
| No account card ever appears | Click **Scan for accounts** on the home screen; confirm `~/.claude/.credentials.json` exists after logging in. |
| Closing the window "quits" nothing | The app minimizes to the **system tray** — right-click the tray icon to quit. |

### Option B — Run from source

Prerequisites: Node.js 20+ (22/24 fine) and npm.

```bash
git clone https://github.com/Hermbot14/claude-code-usage-tracker.git
cd Usage-Tracker
npm install
npm run dev
```

### Scripts

```bash
npm run dev        # dev mode (hot reload)
npm run typecheck  # strict TypeScript check (also gates packaging)
npm run build      # production build (electron-vite)
npm run preview    # build + launch
npm run test:e2e   # Playwright Electron E2E (builds first, launches the app)
npm run package    # typecheck + build + Windows installer & portable (electron-builder)
```

---

## 🧱 Project Structure

```
Usage-Tracker/
├── docs/
│   ├── PROVIDERS.md              # Provider registry + how to add a provider
│   ├── ZAI_API_DOCUMENTATION.md  # Z.AI quota API reference
│   └── IMPLEMENTATION_GUIDE.md
├── e2e/
│   └── app.spec.ts               # Playwright Electron E2E
├── src/
│   ├── main/                     # Electron main process
│   │   ├── index.ts
│   │   ├── ipc-handlers.ts       # fetch-usage, fetch-account-usage, list-providers, discover-local-accounts
│   │   ├── store-service.ts      # JSON store in userData
│   │   ├── tray-manager.ts
│   │   └── providers/            # ── multi-provider usage engine ──
│   │       ├── types.ts          # ProviderDescriptor, NormalizedUsage
│   │       ├── registry.ts       # declarative provider catalog + detect/endpoint
│   │       ├── credentials.ts    # auto-read local OAuth tokens (Claude/Codex/Qwen)
│   │       ├── claude-token.ts   # Claude OAuth refresh + atomic write-back
│   │       ├── normalizers.ts    # Anthropic / Codex / ZAI-Zhipu → NormalizedUsage
│   │       └── usage-service.ts  # resolve + fetch + normalize, rate-limit handling
│   ├── preload/
│   └── renderer/                 # React UI
│       ├── components/
│       │   ├── AccountsView.tsx      # the main multi-card view
│       │   ├── AccountCard.tsx       # one account's session/weekly bars
│       │   ├── AccountsManager.tsx   # add/remove accounts (in Settings)
│       │   ├── SettingsPanel.tsx
│       │   └── ui/
│       ├── hooks/useAccountsData.ts  # discover + poll all accounts
│       ├── stores/useUsageStore.ts   # Zustand store (accounts + per-account usage)
│       ├── lib/ · types/
├── playwright.config.ts
├── electron-builder.json
└── electron.vite.config.ts
```

---

## 🔍 How It Works

Every provider is fetched with a single authenticated `GET` and mapped to a common `NormalizedUsage`:

```ts
{ sessionPercent, weeklyPercent, sessionResetTime, weeklyResetTime, … }
```

- **Anthropic** — `GET /api/oauth/usage` with the Claude Code OAuth token and beta headers; response `{ five_hour.utilization, seven_day.utilization, resets_at }`. The token is auto-refreshed via the OAuth refresh grant and written back to `~/.claude/.credentials.json` (atomic, with a one-time `.bak` backup) so the CLI and app stay in sync.
- **OpenAI Codex** — `GET /backend-api/wham/usage` with the ChatGPT OAuth token; `rate_limit.{primary,secondary}_window.used_percent`.
- **Z.AI / Zhipu** — `GET /api/monitor/usage/quota/limit` with the API key; `data.limits[]` (`TOKENS_LIMIT` → session, `TIME_LIMIT` → weekly/monthly).

The poller runs on your configured interval, but providers declare a **minimum poll interval** (Claude/Codex = 60s) and a **5-minute cooldown on HTTP 429** — within those windows the last good snapshot is served instead of re-hitting the endpoint.

---

## 🧪 Testing

End-to-end tests use **Playwright's Electron support** (the correct tool for Electron — Puppeteer can't attach to the main process):

```bash
npm run test:e2e
```

This builds the app, launches it in an isolated `--user-data-dir` (so it never collides with a running instance), and drives a smoke test plus the full account flow (provider catalog, local-login detection, add account, card render).

---

## 🛠️ Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Electron 32 |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 |
| Build | Vite 5 + electron-vite |
| Storage | JSON store in Electron `userData` |
| E2E | Playwright (Electron) |
| Packaging | electron-builder |

---

## ⚙️ Configuration

| Setting | Default | Notes |
|---------|---------|-------|
| Refresh interval | 5s | Slider 10s–5min; Claude/Codex are throttled to ≥60s regardless |
| Alert thresholds | 80 / 90 / 100% | Desktop notifications |
| Theme / mode | Default / System | 10 themes × light/dark |
| Overlay mode | off | Compact always-on-top corner overlay |

Accounts and settings are persisted in the Electron `userData` directory. Local OAuth tokens are read from the provider CLI's own credential store (`~/.claude`, `~/.codex`) — the app does not copy them into its own config.

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The most common contribution is **adding a provider** — see [docs/PROVIDERS.md](docs/PROVIDERS.md) for the registry/adapter walkthrough.

---

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md). Current: **v2.4.0** — one-click setup with full fallbacks (Install + Sign in on cards too, Codex login, npm-missing links), first-run reliability, renderer CSP, typecheck-gated packaging.

---

## 🙏 Acknowledgments

The usage-tracking engine was extracted and generalized from **[Aperant](https://github.com/AndyMik90/Aperant)** (formerly "Auto-Claude") — an autonomous multi-agent coding framework.

---

## 📜 License

MIT — see [LICENSE](LICENSE).

## 🔗 Links

- **Repository**: [github.com/Hermbot14/claude-code-usage-tracker](https://github.com/Hermbot14/claude-code-usage-tracker)
- **Issues**: [Report a bug](https://github.com/Hermbot14/claude-code-usage-tracker/issues)
