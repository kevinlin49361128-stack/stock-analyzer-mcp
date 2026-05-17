# Stock Analyzer MCP — the first MCP server with full Taiwan stock coverage

**Date**: 2026-05-17
**Audience**: MCP / AI agent builders looking for finance tools
**Author**: Kevin Lin (sole developer of Stock Analyzer)

---

## TL;DR

**Stock Analyzer** is a macOS desktop app that ships with an embedded **Model Context Protocol (MCP) server** exposing **81+ stock-market analysis tools** for both Taiwan (TWSE / TPEx) and US markets. Unlike API-based MCP servers (Alpha Vantage, Financial Datasets, EODHD, etc.), Stock Analyzer's MCP runs **fully local** — no API key fees, no cloud dependency, no data leaves your machine.

If you're building an AI agent that needs to analyze Taiwan stocks, this is currently the only MCP option that covers the market in depth.

---

## Why this matters

Searching the 2026 MCP landscape for "finance / stock / trading":

| Server | TW coverage | US coverage | Local | License model |
|---|---|---|---|---|
| Alpha Vantage MCP | ⚠️ Limited (delayed quotes only) | ✅ Full | ❌ Cloud API | Pay per API call |
| Financial Datasets MCP | ❌ None | ✅ Full | ❌ Cloud API | Subscription |
| EODHD MCP | ⚠️ End-of-day only, no fundamentals | ✅ Full | ❌ Cloud API | Subscription |
| Lambda Finance | ❌ None | ✅ Full + options | ❌ Cloud | Subscription |
| Stockflow (Yahoo) | ⚠️ Yahoo's spotty TW data | ✅ Full | ❌ Cloud API | Free (rate-limited) |
| **Stock Analyzer MCP** | ✅ **Deep TWSE + TPEx + institutional flow + chip data** | ✅ Full | ✅ **Local SQLite** | One-time purchase ($99-149) |

For non-Taiwan readers: Taiwan stock market has its own data ecosystem (TWSE, TPEx OpenAPI, three major institutional investors, monthly revenue reporting) that's almost entirely absent from English-speaking financial data platforms. If you want an AI agent that can answer "幫我看 2330 (TSMC) 最近三大法人是怎麼進出的?" / "How are TSMC's institutional investors trading lately?", Stock Analyzer's MCP is currently the only viable option.

---

## What 81 tools? (Category breakdown)

| Category | Tools | Examples |
|---|---|---|
| **market** (12) | Quotes, history, heatmap, sector ranking, news, FX, seasonality, ETF holdings, trading-day status | `get_stock_price`, `get_market_heatmap`, `get_seasonality` |
| **chips** (6) | Three major institutional flows, fund flow Sankey, insider alerts, abnormal blocks, margin ranking | `get_institutional_flow`, `get_fund_flow_sankey`, `get_insider_alerts` |
| **fundamentals** (6) | Financial statements, monthly revenue, dividends, EPS, DCF valuation | `get_financial_statements`, `get_monthly_revenue`, `calculate_dcf` |
| **technical** (5) | RSI / MACD / KD / Bollinger / Beta / correlation / candlestick patterns | `get_technical_indicators`, `detect_kline_patterns`, `get_stock_beta` |
| **macro** (8) | FED policy, yield curve, inflation, employment, earnings calendar | `get_macro_snapshot`, `get_yield_curve`, `get_fed_policy_stance` |
| **sentiment** (5) | News sentiment, market sentiment, per-stock sentiment, forecasts, entry strategies | `get_stock_sentiment_v2`, `get_sentiment_forecasts` |
| **portfolio** (11) | Holdings, P&L, performance, concentration, signals, trade CRUD | `get_portfolio`, `get_portfolio_concentration`, `analyze_trade_performance` |
| **backtest** (5) | Single-stock backtest, multi-strategy, grid search, Monte Carlo factor mining, random portfolio | `backtest_strategy`, `monte_carlo_factor_mining` |
| **risk** (3) | VaR, systemic risk, portfolio optimization | `calculate_portfolio_var`, `get_systemic_risk`, `optimize_portfolio` |
| **ai workflow** (4) | Full-stock analysis, screener, workflows, notes | `get_full_stock_analysis`, `screen_stocks` |
| **thesis** (6) | Investment hypothesis CRUD + invalidate / reactivate | `upsert_thesis`, `invalidate_thesis` |
| **watchlist** (4) | Watchlist CRUD | `add_watchlist`, `update_watchlist` |
| **alert** (3) | Price alerts CRUD | `set_price_alert` |

All 81 tools are tagged with **tier metadata** (`lite`/`standard`/`premium`) so an agent calling `/api/mcp/tools` can know in advance which tools are unlocked at the current license tier.

---

## Three things that make this different

### 1. Local-first architecture
- All data lives in `~/.twse-analyzer/stock_history.db` (SQLite, single file)
- MCP server runs in-process inside the Electron app
- No tokens needed for Claude Desktop / Claude Code (stdio mode)
- Optional HTTP mode with bearer-token auth for remote agents

### 2. BYOK LLM integration (when you actually want LLMs)
- Stock Analyzer itself has an AI Hub that consumes the same 81 tools
- You bring your own keys (Claude / GPT / Gemini / Ollama)
- The MCP server is **not** tied to any particular LLM — anything that speaks MCP works

### 3. Transparent methodology
- Every analytical tool has a corresponding methodology page (`/methodology.html` and 15 sub-pages) explaining the formula, data source, and known limitations
- 0.46.5+ ships with full bilingual (zh-TW + en) methodology coverage
- Citations are explicitly vetted; ~50 academic references across the methodology pages have been audit-verified (post-2026-05 sprint)

---

## Quickstart: Claude Desktop

After installing Stock Analyzer:

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "stock-analyzer": {
      "command": "node",
      "args": ["/Applications/Stock Analyzer.app/Contents/Resources/app.asar/mcp-server.js"],
      "env": { "PORT": "3000" }
    }
  }
}
```

Then in Claude Desktop:

> "List all SAA stock-analyzer tools"

You'll see 81 tools categorized. Now ask anything:

> "Analyze 2330 — institutional flow trend last month + 3-month momentum + radar score + give me a buy/sell view"

Claude will orchestrate multiple tool calls and synthesize.

---

## Pricing & how to get it

| Tier | Price | What you get |
|---|---|---|
| **Lite** | Free | ~50 tools across market / fundamentals / technical / sentiment / portfolio / AI workflow / thesis / watchlist / alert |
| **Standard** | NT$1,499 one-time (~US$47) | + US stock real-time, advanced backtest (multi-strategy / grid search), optimize portfolio |
| **Premium** | NT$2,999 one-time (~US$94) | + Monte Carlo factor mining, parametric VaR, systemic risk, Multi-Agent stock debate (0.47-beta+) |

One-time purchase via Lemon Squeezy (MoR) — never subscription, never lock-in. v1 license is permanent for all v1.* updates.

Get it: [https://stockanalyzer.tw](https://stockanalyzer.tw)

---

## Roadmap (post-2026-05)

- **Multi-Agent Stock Debate** (0.47-beta) — 5 AI agents (Bull / Bear / Sentiment / Risk / Synthesizer) collaborate to produce one consolidated stock recommendation. Inspired by [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) but adapted for desktop BYOK + privacy. Premium-only.
- **Regime-aware Strategy Recommender** (0.47-beta) — Reads current Bry-Boschan regime + rule signals → recommends which backtest strategies to test next. One-click prefill.
- **Sentiment forecast keyword bridge** (in progress) — make `get_sentiment_forecasts` / `get_sentiment_entry_strategies` more discoverable for "未來走勢 / future trend / forecast" queries.

---

## Try it / contact

- **Download**: [stockanalyzer.tw](https://stockanalyzer.tw)
- **MCP usage guide**: bundled in app, also at `/docs/MCP-USAGE-GUIDE.md` in repo
- **Methodology**: every analytical tool has a transparent methodology page at `/methodology.html` (16 sub-pages, full zh + en)
- **Contact**: hello@stockanalyzer.tw

If you build something cool with the SAA MCP server, let me know — I'd love to feature it on the landing page.

---

# 繁體中文版

## TL;DR

**Stock Analyzer** 是一款 macOS 桌面 App，內建 **Model Context Protocol (MCP) server**，提供 **81+ 個股市分析工具**，同時涵蓋台股（TWSE / TPEx）與美股。和大多數 API-based MCP server（Alpha Vantage、Financial Datasets、EODHD…）不同，**Stock Analyzer 的 MCP 完全跑在本機** — 沒 API 費用、沒雲端依賴、資料不外流。

如果你想做能分析台股的 AI agent，這目前是唯一深度覆蓋台股的 MCP 選項。

## 為什麼這個重要

2026 年掃了一輪 MCP 生態的「finance / stock / trading」類別：國外那批 MCP server（Alpha Vantage、Financial Datasets、EODHD、Lambda Finance、Stockflow）**幾乎都不碰台股**，或只有 Yahoo 的零星 ADR 資料。台股有自己的資料生態（TWSE / TPEx OpenAPI、三大法人、月營收 EPS、籌碼 / 內部人），這套 niche 在英文圈完全沒人做。

對於想做「幫我分析 2330 最近三大法人怎麼進出？」、「我的台股投組現在風險集中度怎樣？」這種問題的 AI agent 來說，**Stock Analyzer MCP 目前是唯一可用方案**。

## 81 個工具分佈

詳見上方英文版表格。主要類別：market (12) / chips (6) / fundamentals (6) / technical (5) / macro (8) / sentiment (5) / portfolio (11) / backtest (5) / risk (3) / ai workflow (4) / thesis (6) / watchlist (4) / alert (3)。

## 設計差異化

1. **完全本地架構** — 資料存 `~/.twse-analyzer/stock_history.db`（單檔 SQLite），MCP server 跑在 Electron in-process，Claude Desktop 走 stdio 不用 token
2. **BYOK LLM**（自備 API key）— Stock Analyzer 自帶的 AI Hub 用同一套 81 工具，使用者自帶 Claude / GPT / Gemini / Ollama key；MCP server 本身對 LLM 不挑食
3. **透明方法論** — 每個分析工具都有對應方法論頁說明公式、資料來源、已知限制；16 個方法論頁全雙語；學術引用經 audit verification

## 怎麼買 / 試用

- **Lite（免費）**：~50 個 lite tier 工具，永久免費
- **Standard NT$1,499（一次性）**：加美股即時 + 進階回測 + portfolio optimize
- **Premium NT$2,999（一次性）**：加 Monte Carlo 因子探索、Parametric VaR、Systemic Risk、Multi-Agent 個股辯論（0.47-beta 後新增）

買斷制，無訂閱，v1 license 對所有 v1.* 更新永久有效。

下載：[stockanalyzer.tw](https://stockanalyzer.tw)

---

**Distribution**: This blog post is the canonical description for MCP marketplace listings.
Repo-friendly version: [`docs/blog/mcp-launch-2026-05.md`](docs/blog/mcp-launch-2026-05.md).
