# Stock Analyzer MCP

> 📡 The **Model Context Protocol** server bundled with [Stock Analyzer](https://stockanalyzer.tw) — a macOS desktop app for Taiwan + US stock market analysis.
>
> **An MCP server with deep Taiwan stock coverage** (TWSE / TPEx + three major institutional flows + chip data + monthly revenue). 87 tools across 14 categories + 6 resources. **Local-first** — runs in-process inside the Electron app, no API costs, no cloud dependency.

**Current version**: MCP server `1.2.1` · Stock Analyzer app `0.47.9-beta` · Updated 2026-05-27

---

## ⚠️ How this MCP server actually works

This repo contains the **MCP shim source** (mcp-server.js + lib/ai-tools + Dockerfile). The shim is a **thin HTTP-to-stdio bridge** — when an MCP client invokes a tool, the shim proxies the call to `http://localhost:3000/api/*`, where the **Stock Analyzer desktop app's embedded Express backend** does the actual work (DB query, computation, analysis).

> **The MCP server in this repo, run standalone (e.g. via `docker run`), can advertise its 87 tools through introspection but cannot execute them.** You need [Stock Analyzer](https://stockanalyzer.tw) running on the same machine for tools to actually return data.

This split is intentional — the analysis engine + market data + license-gated features live in the closed-source desktop app; the MCP shim is open-source (MIT) so the integration surface is fully transparent.

---

## Why this repo exists

The Stock Analyzer desktop app itself is a commercial product (Lite tier free, Standard NT$1,499, Premium NT$2,999 — all one-time purchases, no subscription). This repo exists to:
- Open-source the **MCP shim layer** under MIT so marketplaces (awesome-mcp-servers, mcpservers.org, PulseMCP, Glama) can build & verify a working image
- Provide a public canonical link for MCP discovery
- Host the integration guide separately from the closed app source
- Make Claude Desktop / Claude Code / agentic frameworks easy to configure against the bundled MCP server

---

## Build (Docker, for Glama / marketplaces)

```bash
docker build -t stock-analyzer-mcp .
docker run -i --rm stock-analyzer-mcp   # stdio JSON-RPC on stdin/stdout
```

Image is ~258 MB (node:20-alpine + 2 npm deps). The build skips `better-sqlite3`, Electron, and other backend-only dependencies because the shim itself never imports them — all data calls go via HTTP to the locally-running Stock Analyzer app's `/api/*` endpoints.

---

## What's in this MCP server

### 87 tools across 14 categories

| Category | Tools | Examples |
|---|---|---|
| market (13) | Quotes, history, heatmap, sector ranking, news, FX, seasonality, ETF holdings | `get_stock_price`, `get_market_heatmap`, `get_seasonality` |
| chips (6) | Three major institutional flows, fund flow Sankey, insider alerts, abnormal blocks, margin ranking | `get_institutional_flow`, `get_fund_flow_sankey` |
| fundamentals (6) | Financial statements, monthly revenue, dividends, EPS, DCF valuation | `get_financial_statements`, `calculate_dcf` |
| technical (5) | RSI / MACD / KD / Bollinger / Beta / correlation / candlestick patterns | `get_technical_indicators`, `detect_kline_patterns` |
| macro (8) | FED policy, yield curve, inflation, employment, earnings calendar | `get_macro_snapshot`, `get_fed_policy_stance` |
| sentiment (5) | News sentiment, market sentiment, per-stock sentiment, forecasts, entry strategies | `get_stock_sentiment_v2`, `get_sentiment_forecasts` |
| portfolio (11) | Holdings, P&L, performance, concentration, signals, trade CRUD | `get_portfolio`, `get_portfolio_concentration` |
| backtest (5) | Single-stock, multi-strategy, grid search, MC factor mining, random portfolio | `backtest_strategy`, `monte_carlo_factor_mining` |
| risk (3) | VaR, systemic risk, portfolio optimization | `calculate_portfolio_var`, `get_systemic_risk` |
| ai workflow (6) | Full-stock analysis, screener, workflows, notes, **+ deep-dive debate + daily briefing + candidate comparison + post-trade review** | `research_stock_deep_dive`, `portfolio_daily_briefing` |
| thesis (6) | Investment hypothesis CRUD | `upsert_thesis` |
| watchlist (4) | Watchlist CRUD | `add_watchlist` |
| alert (3) | Price alerts | `set_price_alert` |
| backfill (2) | Admin data backfill | `trigger_backfill` |

Every tool carries:
- **`annotations.readOnlyHint`** — whether the tool modifies state (clients auto-confirm before destructive ops)
- **`annotations.destructiveHint`** — `delete_*` / `cancel_*` flagged true
- **`annotations.idempotentHint`** — `upsert_*` / `update_*` flagged true
- **`_meta.tw.stockanalyzer/estimated_cost_usd`** — worst-case LLM cost (most tools $0; deep-dive ~$0.16)

### 6 resources (Claude Desktop `@`-mentionable)

Inject context into your conversation without burning tool calls:

| Resource | Content |
|---|---|
| `saa://portfolio` | Full holdings (TW + US, USD/TWD unified pricing, unrealized P&L) |
| `saa://watchlist` | All watchlist entries with live quotes + alert states |
| `saa://thesis` | Active investment theses (hypothesis, key levels, next review dates) |
| `saa://market/today` | Three major institutional flows / sector winners / systemic risk / FX |
| `saa://reports/recent` | Latest portfolio briefing (free; doesn't auto-trigger LLM) |
| `saa://system/info` | Server introspection (version, schema version, active profile, tool count) |

### Profiles (filter what gets exposed)

Set `SAA_MCP_PROFILE` env var to gate which tools are visible to the LLM client:

| Profile | Tools exposed | Use case |
|---|---|---|
| `default` (omit) | All 85 | Your personal Claude Desktop |
| `safe_readonly` | 72 read-only tools | Shared / untrusted LLM clients — blocks `add_trade` / `delete_*` / `upsert_thesis` / `set_price_alert` / etc. |

Resources stay available in both profiles (they're read-only by definition).

---

## How it compares

| Server | TW coverage | US coverage | Local | License model |
|---|---|---|---|---|
| Alpha Vantage MCP | ⚠️ Delayed quotes only | ✅ Full | ❌ Cloud API | Pay per call |
| Financial Datasets MCP | ❌ None | ✅ Full | ❌ Cloud API | Subscription |
| EODHD MCP | ⚠️ EOD only | ✅ Full | ❌ Cloud API | Subscription |
| Lambda Finance | ❌ None | ✅ Full + options | ❌ Cloud | Subscription |
| Stockflow (Yahoo) | ⚠️ Spotty TW data | ✅ Full | ❌ Cloud | Free (rate-limited) |
| **Stock Analyzer MCP** | ✅ **Deep TWSE + TPEx + institutional + chip** | ✅ Full | ✅ **Local SQLite** | One-time license (Lite free) |

For non-Taiwan readers: Taiwan stock market has its own data ecosystem (TWSE, TPEx OpenAPI, three major institutional investors, monthly revenue reporting) that's nearly absent from English-speaking financial data platforms. If you want an AI agent that can answer "How are TSMC's institutional investors trading lately?" or "Find me TW small-caps with >30% YoY revenue growth", Stock Analyzer MCP is built for exactly this — deterministic TW chip/institutional/revenue tools that English-focused MCP servers generally lack.

---

## Quickstart: Claude Desktop

### 1. Install Stock Analyzer

Get the free Lite tier from [stockanalyzer.tw](https://stockanalyzer.tw). Version `0.47.4-beta` or later ships MCP server v1.2.0.

### 2. Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```jsonc
{
  "mcpServers": {
    "stock-analyzer": {
      "command": "/Applications/Stock Analyzer.app/Contents/Resources/app.asar.unpacked/bin/saa-mcp",
      "env": { "PORT": "3000" }
    }
  }
}
```

> **Why the wrapper?** Running `node mcp-server.js` directly hits a `better-sqlite3` ABI mismatch (the binding is compiled for Electron's Node, not the system's). The `bin/saa-mcp` wrapper auto-finds the SAA Electron runtime and runs the MCP server with `ELECTRON_RUN_AS_NODE=1`. Older configs that point to `node` will need updating.

### 3. (Optional) Restrict to read-only mode

If the LLM client isn't fully trusted (shared Claude project, third-party agent), add:

```jsonc
"env": { "PORT": "3000", "SAA_MCP_PROFILE": "safe_readonly" }
```

This blocks 15 write tools (`add_trade`, `delete_trade`, `upsert_thesis`, `set_price_alert`, etc.) but keeps all read tools + all 6 resources.

### 4. Fully restart Claude Desktop (`cmd+Q` then reopen)

### 5. Try it

> "List all SAA stock-analyzer tools"
>
> "Analyze 2330 — institutional flow last month + 3-month momentum + radar score + give me a buy/sell view"
>
> "@saa://portfolio — what's my biggest concentration risk?"
>
> "Compare 2330, 2454, and 3008 as candidates. Include their theses if they exist."

Claude will orchestrate multiple tool calls (or `@`-mentions for resources) and synthesize a research report.

---

## Headline tools (2026-05-18)

### 🎭 `research_stock_deep_dive` — Premium tier
5 specialized AI agents debate in parallel:
- 🐂 Bull (only sees evidence supporting an upside thesis)
- 🐻 Bear (only sees evidence supporting a downside thesis)
- 📰 Sentiment (news + social signals)
- 🛡️ Risk (volatility, drawdown history, regime context)
- 🎯 Synthesizer (sees all four; produces a 6-level action: `strong_buy` → `avoid`)

Each agent uses a distinct subset of the 87 tools. Output includes per-agent reasoning + final action + confidence score. ~$0.16/call LLM cost (Anthropic Sonnet / OpenAI).

### 🌅 `portfolio_daily_briefing` — Lite tier
Pre-market or post-market portfolio briefing. Aggregates current holdings, unrealized P&L, sector exposure, relevant macro / institutional flow into an actionable summary.

- `mode='get'` → reads the latest cached briefing (free, instant)
- `mode='generate'` → runs a fresh one (~10-20s, ~$0.04/call LLM cost)

### 🔍 `compare_investment_candidates` — Lite, cost $0
Side-by-side deep analysis of 2-5 candidate stocks. Parallel fan-out of `get_full_stock_analysis` (fundamentals + technical + chip + institutional + levels) per candidate, plus existing thesis status. **Deterministic** — the agent sees raw evidence rather than an LLM-synthesized opinion, which empirically produces better reasoning.

### 📓 `post_trade_review` — Lite, cost $0
Past-N-days reflection. Aggregates `analyze_trade_performance` (FIFO P&L, win rate, hold time) + `get_trade_journal` (recent trades) + `get_portfolio_signals` (current state). Auto-detects observable patterns:

- `low_win_rate` (< 40%) → systematic selection or timing problem
- `over_trading` (avg hold < 5 days) → fees eating returns
- `lopsided_pnl` (avg loss > avg win) → poor stop-loss discipline

Hands the agent objective indicators to write narrative review against.

---

## Documentation

- **Full MCP usage guide** (zh-TW + en): [`MCP-USAGE-GUIDE.md`](./MCP-USAGE-GUIDE.md) — Claude Desktop setup, troubleshooting, conversation examples
- **Launch blog post** (bilingual): [`docs/mcp-launch-2026-05.md`](./docs/mcp-launch-2026-05.md) — context on the 2026 MCP finance landscape + why TW coverage was the gap
- **Tool reference**: bundled inside the app at Settings → 🔌 MCP / Agent

---

## Design philosophy

- **Local-first**: All data lives in `~/.twse-analyzer/stock_history.db` (SQLite, single file). MCP server runs in-process inside the Electron app via stdio transport.
- **BYOK LLM**: SAA itself has an AI Hub that consumes the same 87 tools. Bring your own keys (Claude / GPT / Gemini / Ollama). The MCP server itself isn't tied to any LLM — it just exposes deterministic data + a few LLM-backed aggregators.
- **Transparent methodology**: 16 bilingual methodology pages (zh-TW + en) explain every analytical tool's formula, data source, and limitations. Available at `/methodology.html` inside the app.
- **No active trading signals**: Research output only — not order execution. Regulatory + product positioning decision.
- **Cost honesty**: Every tool surfaces its worst-case LLM cost upfront via `_meta.tw.stockanalyzer/estimated_cost_usd`. No hidden cloud-API spend.

---

## Versioning

The MCP server uses two version numbers:

| Field | Meaning | Bump on |
|---|---|---|
| `server_version` | SAA MCP binary version (shown at `initialize`) | Each SAA app release |
| `tools_schema_version` (in `saa://system/info`) | Tool/resource shape version | Tool added/removed/renamed/required-changed |

Rules:
- **patch** — additive (new tool, new resource)
- **minor** — new required param, new enum restriction, `readOnlyHint` change
- **major** — rename, removal, required-keys change

Current: server `1.2.0`, schema `1.2.0`. Changelog inside `mcp-server.js` header.

---

## License

This documentation repo is MIT licensed (see [`LICENSE`](./LICENSE)). The Stock Analyzer app itself is closed-source commercial software.

---

## Contact

- **Website**: [stockanalyzer.tw](https://stockanalyzer.tw)
- **Email**: hello@stockanalyzer.tw
- **Issues**: Use GitHub Issues on this repo for MCP integration questions
- **For app feature requests or bug reports**: email above
