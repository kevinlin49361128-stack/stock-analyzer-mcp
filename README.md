# Stock Analyzer MCP

> 📡 The **Model Context Protocol** server bundled with [Stock Analyzer](https://stockanalyzer.tw) — a macOS desktop app for Taiwan + US stock market analysis.
>
> **First MCP server with deep Taiwan stock coverage** (TWSE / TPEx + three major institutional flows + chip data + monthly revenue). 81 tools across 14 categories. **Local-first** — runs in-process inside the Electron app, no API costs, no cloud dependency.

---

## Why this exists

This is the **public documentation repo** for the MCP server that ships inside the [Stock Analyzer](https://stockanalyzer.tw) desktop app.

The app itself is a commercial product (Lite tier free, Standard NT$1,499, Premium NT$2,999 — all one-time purchases, no subscription). This docs repo exists to:
- Provide a public canonical link for MCP marketplaces (awesome-mcp-servers, mcpservers.org, PulseMCP)
- Host the MCP integration guide separately from the closed app source
- Make Claude Desktop / Claude Code / agentic frameworks easy to configure against the bundled MCP server

---

## What's in this MCP server

**81 tools across 14 categories:**

| Category | Tools | Examples |
|---|---|---|
| market (12) | Quotes, history, heatmap, sector ranking, news, FX, seasonality, ETF holdings | `get_stock_price`, `get_market_heatmap`, `get_seasonality` |
| chips (6) | Three major institutional flows, fund flow Sankey, insider alerts, abnormal blocks, margin ranking | `get_institutional_flow`, `get_fund_flow_sankey` |
| fundamentals (6) | Financial statements, monthly revenue, dividends, EPS, DCF valuation | `get_financial_statements`, `calculate_dcf` |
| technical (5) | RSI / MACD / KD / Bollinger / Beta / correlation / candlestick patterns | `get_technical_indicators`, `detect_kline_patterns` |
| macro (8) | FED policy, yield curve, inflation, employment, earnings calendar | `get_macro_snapshot`, `get_fed_policy_stance` |
| sentiment (5) | News sentiment, market sentiment, per-stock sentiment, forecasts, entry strategies | `get_stock_sentiment_v2`, `get_sentiment_forecasts` |
| portfolio (11) | Holdings, P&L, performance, concentration, signals, trade CRUD | `get_portfolio`, `get_portfolio_concentration` |
| backtest (5) | Single-stock, multi-strategy, grid search, MC factor mining, random portfolio | `backtest_strategy`, `monte_carlo_factor_mining` |
| risk (3) | VaR, systemic risk, portfolio optimization | `calculate_portfolio_var`, `get_systemic_risk` |
| ai workflow (4) | Full-stock analysis, screener, workflows, notes | `get_full_stock_analysis`, `screen_stocks` |
| thesis (6) | Investment hypothesis CRUD | `upsert_thesis` |
| watchlist (4) | Watchlist CRUD | `add_watchlist` |
| alert (3) | Price alerts | `set_price_alert` |
| backfill (2) | Admin data backfill | `trigger_backfill` |

Every tool is tagged with **tier metadata** (`lite`/`standard`/`premium`) so an agent calling `/api/mcp/tools` can know in advance which tools are unlocked at the current license.

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

For non-Taiwan readers: Taiwan stock market has its own data ecosystem (TWSE, TPEx OpenAPI, three major institutional investors, monthly revenue reporting) that's nearly absent from English-speaking financial data platforms. If you want an AI agent that can answer "How are TSMC's institutional investors trading lately?" or "Find me TW small-caps with >30% YoY revenue growth", Stock Analyzer MCP is currently the only viable option.

---

## Quickstart: Claude Desktop

### 1. Install Stock Analyzer

Get the free Lite tier from [stockanalyzer.tw](https://stockanalyzer.tw).

### 2. Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```jsonc
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

### 3. Fully restart Claude Desktop (`cmd+Q` then reopen)

### 4. Try it

> "List all SAA stock-analyzer tools"
>
> "Analyze 2330 — institutional flow last month + 3-month momentum + radar score + give me a buy/sell view"

Claude will orchestrate multiple tool calls and synthesize a research report.

---

## Quickstart: Remote agent / programmatic use

For external agents (Python script, custom workflow, cross-machine), use HTTP mode with bearer-token auth:

```python
import requests

TOKEN = "your-agent-token"  # generated in SAA Settings → MCP / Agent

def saa_call(name, **args):
    r = requests.post(
        "http://localhost:3000/mcp",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={"name": name, "args": args},
        timeout=30,
    )
    return r.json()

quote = saa_call("get_stock_price", code="2330")
print(quote)
```

---

## Documentation

- **Full MCP usage guide**: [`MCP-USAGE-GUIDE.md`](./MCP-USAGE-GUIDE.md) — including remote agent setup, error handling, troubleshooting
- **Launch blog post**: [`docs/mcp-launch-2026-05.md`](./docs/mcp-launch-2026-05.md) — context on the 2026 MCP finance landscape + why TW coverage was the gap
- **Tool reference**: bundled inside the app at SAA → Settings → 🔌 MCP / Agent

---

## Design philosophy

- **Local-first**: All data lives in `~/.twse-analyzer/stock_history.db` (SQLite, single file). MCP server runs in-process inside the Electron app.
- **BYOK LLM**: SAA itself has an AI Hub that consumes the same 81 tools. Bring your own keys (Claude / GPT / Gemini / Ollama). The MCP server itself isn't tied to any LLM.
- **Transparent methodology**: 16 bilingual methodology pages (zh-TW + en) explain every analytical tool's formula, data source, and limitations. Available at `/methodology.html` inside the app.
- **No active trading signals**: Research output only — not order execution. Regulatory + product positioning decision.

---

## License

This documentation repo is MIT licensed (see [`LICENSE`](./LICENSE)). The Stock Analyzer app itself is closed-source commercial software.

---

## Contact

- **Website**: [stockanalyzer.tw](https://stockanalyzer.tw)
- **Email**: hello@stockanalyzer.tw
- **Issues**: Use GitHub Issues on this repo for MCP integration questions
- **For app feature requests or bug reports**: email above
