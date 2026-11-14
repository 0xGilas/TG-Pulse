# TeleScope — Precision Telegram Channel Analytics & Daily Share Attribution

**TeleScope** is an open-source, 100% client-side, zero-backend Telegram channel analytics web application designed for static hosting (such as GitHub Pages). It connects directly from your browser to Telegram's servers using **MTProto inside a dedicated Web Worker** (`@mtcute/web` + `@mtcute/wasm`) and solves one of Telegram's biggest native analytics blindspots: **pinpointing exactly which posts generated any day's Views and Shares**, including private forwards and older archive posts.

---

## Why TeleScope Exists

In Telegram's native **Channel Statistics**:
1. The **Interactions** graph counts every View and Share happening on a given calendar date across your **entire channel history**.
2. The **Recent Posts** list only displays messages published within the **current 7-day window**.
3. When subscribers forward an **older post** or a specific item inside a **media album (`grouped_id`)**—especially to private chats or Saved Messages—the channel graph records the share spike without telling you which post was shared.

### How TeleScope Solves It (`stats.getMessageStats` Attribution Engine)
Telegram actually stores a per-message daily timeline inside `stats.getMessageStats(channel, msgId)`. Each message's `viewsGraph` contains **both daily `Views` and daily `Shares`** (covering public reposts *and* private forwards), while `stats.getMessagePublicForwards` identifies public channel reposts.

TeleScope:
- Scans your channel archive inside a Web Worker and groups multi-media albums (`grouped_id`) while preserving per-item `forwards` counters.
- Runs batch, rate-limit-safe (`FLOOD_WAIT` aware) queries against `stats.getMessageStats` and `stats.getMessagePublicForwards`.
- Aggregates every post's daily `Views` & `Shares` into a per-date attribution index so clicking **any date** on the channel Interactions chart reveals each post's exact share and view contribution (`% of day`), **Public vs. Private Shares** split, and **Evergreen (>48h long-tail) Share %**.

---

## Key Analytics Beyond Native Telegram

- **Exact Per-Date Views & Shares Attribution**: Click any date on the channel Interactions timeline to see which specific posts—including older posts outside the 7-day window—produced that date's Views and Shares.
- **Public vs. Private Share Split**: Separates public channel reposts (`stats.getMessagePublicForwards`) from private/DM/group/Saved Messages shares.
- **Statistical Channel Benchmarks**: Computes **Median Views**, **P90 Viral Outlier Threshold**, **Median Share Rate**, and **Evergreen Share %** so single outliers don't skew your baseline.
- **7×6 Posting Performance Matrix**: Aggregates average Share Rate and Views across **Weekday × 4-hour UTC slots** to surface your channel's Golden Posting Window.
- **Album (`grouped_id`) Child Forward Breakdown**: Inspect whether users forwarded the entire album or an individual photo, audio track, or document inside it.
- **Local Snapshots & CSV/JSON Export**: Capture baseline snapshots in `IndexedDB` or export full post telemetry as `.csv` / `.json`.

---

## Security & Zero-Backend Threat Model

Because viewing channel statistics requires an authenticated Telegram user session (Telegram Bot API tokens cannot call `stats.getBroadcastStats` or `stats.getMessageStats`), TeleScope is engineered to minimize trust:

| Layer | Security Guarantee |
| :--- | :--- |
| **Zero Backend** | No server receives your phone number, 2FA password, `api_hash`, MTProto session key, or channel messages. All MTProto encryption runs locally inside your browser Web Worker. |
| **Ephemeral RAM Default** | Uses `@mtcute/web`'s `MemoryStorage` by default. Closing or refreshing the browser tab destroys the session immediately. |
| **Opt-In Encrypted Vault** | Only if you explicitly check *"Encrypt & remember my session"*, your exported session is encrypted with **WebCrypto `AES-256-GCM` + `PBKDF2-SHA256` (120,000 iterations)** using your optional Vault PIN and stored in `IndexedDB`. |
| **BYO API Credentials** | Enter your own `api_id` and `api_hash` from [my.telegram.org](https://my.telegram.org) directly in the UI—never hardcoded in source control. |
| **One-Click Wipe** | **Logout & Wipe** terminates the Telegram authorization (`auth.logOut`) and clears encrypted vault records. |

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Browser Main Thread (React 19 + Telegram Liquid Glass UI)                 │
│  ├─ AuthScreen (QR / Phone / 2FA / Masked PasswordField + Eye Toggle)     │
│  ├─ OverviewTab (KPIs, Benchmarks, Clickable Graph, Date Attribution)     │
│  ├─ ShareDetectiveTab (Median Multiplier, Pub/Priv Split, Evergreen %)    │
│  └─ AudienceTab (Top Hours, 7×6 Weekday×4h Matrix, Format Efficiency)     │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │ Typed RPC (postMessage)
┌───────────────────────────────▼───────────────────────────────────────────┐
│ Dedicated Web Worker (src/worker/mtproto.worker.ts)                       │
│  ├─ @mtcute/web + @mtcute/wasm + MemoryStorage (Ephemeral RAM)            │
│  ├─ stats.getBroadcastStats / stats.loadAsyncGraph                        │
│  ├─ stats.getMessageStats (daily Views + Shares per post)                 │
│  └─ stats.getMessagePublicForwards (Public vs Private split)              │
└──────────┬────────────────────────────┬───────────────────────┬───────────┘
           │                            │                       │
     [Direct WSS]              [Local SOCKS5 Bridge]     [Personal CF Relay]
           │                   ws://127.0.0.1:8787       wss://...workers.dev
           │                            │                       │
           ▼                            ▼                       ▼
  Telegram Web DCs         packages/socks-bridge        packages/cf-worker-relay
 (*.web.telegram.org)      (socks5h:// + DC allowlist)  (*.web.telegram.org only)
```

---

## Network & Proxy Setup (Direct, SOCKS5, or Cloudflare Relay)

Browsers cannot open raw TCP sockets directly to a SOCKS5 server. TeleScope supports three transport modes from **Proxy / SOCKS5 Settings**:

### 1. Direct WebSocket (`WSS`)
Connects directly from your browser to `*.web.telegram.org`. Works anywhere Telegram WebSocket endpoints are reachable.

### 2. SOCKS5 Proxy via Local Bridge (`packages/socks-bridge`)
Run the included open-source Node.js bridge locally. It binds strictly to `127.0.0.1:8787` and enforces a strict `*.web.telegram.org` hostname allowlist so it cannot be abused as an open proxy:

```bash
cd packages/socks-bridge
npm install
node index.mjs
```

Then open **Proxy / SOCKS5 Settings** in TeleScope, choose **SOCKS5 Proxy (Local Bridge)**, enter your SOCKS5 `host`, `port`, and optional `username`/`password`, and click **Test Bridge Connection**.

### 3. Personal Cloudflare Worker Relay (`packages/cf-worker-relay`)
Deploy `packages/cf-worker-relay/worker.js` to your own Cloudflare Workers account (also restricted strictly to `*.web.telegram.org`), then paste your `wss://your-worker.workers.dev` URL into Network Settings.

---

## Getting Your Own Telegram API Keys (`my.telegram.org`)

1. Sign in at [https://my.telegram.org](https://my.telegram.org) with your Telegram phone number.
2. Open **API development tools** and create an application.
3. Copy your numeric **App `api_id`** and 32-character hex **App `api_hash`**.
4. Expand **Custom API Credentials** on the TeleScope sign-in card and paste them in (saved only in your browser).

---

## Local Development & Testing

```bash
# Install dependencies (recommended, uses bun.lock)
bun install
# Or with npm:
# npm install --legacy-peer-deps

# Run unit tests (attribution math, benchmarks, 7x6 matrix, snapshot deltas, crypto vault)
bun test src/utils/analyticsMath.test.ts src/utils/cryptoVault.test.ts

# Start dev server (http://localhost:3000)
bun run dev

# Typecheck & production build
bun run lint
bun run build
```

---

## GitHub Pages Deployment

The repository includes `.github/workflows/deploy.yml` configured for **Bun** (`bun.lock`) and static deployment (`vite.config.ts` with `base: './'`).
1. In your GitHub repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Push to `main` (or `master`), or trigger the workflow manually from the **Actions** tab to test, build, and publish `dist/` to GitHub Pages.
