# SAA MCP 使用教學

**對象**：想把 Claude Desktop / Claude Code / 自家 agent 接上 SAA 的用戶。

**最後更新**：2026-05-18（SAA 0.47.2-beta / MCP server v1.2.0）

---

## 1. 什麼是 MCP？

**Model Context Protocol（MCP）** 是 Anthropic 開源的協議，讓 AI 助理（Claude / GPT / Gemini 等）可以呼叫外部工具。SAA 把 **92 個分析工具 + 6 個 resources**（個股報價、籌碼、財報、回測、AI 篩選、Multi-Agent 辯論、Daily Briefing…）透過 MCP 開放給 AI 用。

接上後，你可以在 Claude Desktop 用自然語言對話：

> 「2330 最近三大法人怎麼買？」
> 「@saa://portfolio 我目前風險集中度怎樣？」
> 「找出最近一週 RSI < 30 的台股」
> 「對 2330 跑 multi-agent 深度研究」

Claude 自動選擇對應的 SAA 工具、傳參、把結果整合成回答。

---

## 2. 連線方式

SAA MCP 目前只支援 **stdio transport**（同一台 Mac 上）— 透過 `bin/saa-mcp` wrapper 啟動。HTTP / SSE remote transport 尚未實作。

- 場景：Claude Desktop / Claude Code / 本機 agent CLI 都在你的 Mac 上跑
- 不需 token，授權方式：macOS 沙盒對 SAA app 的執行權限
- 整合方式：`claude_desktop_config.json` 設好就直接連上

---

## 3. 設定 Claude Desktop（最常見的場景）

### 步驟 1：取得 SAA 設定 JSON

在 SAA 內：
1. 開啟設定面板（左側 sidebar → 🛠️ 設定）
2. 找「🔌 MCP / Agent 連接」區塊
3. 點 **「📋 複製設定」** 按鈕

複製出來的 JSON 大致長這樣（**0.47.2-beta 後簡化版**）：

```json
{
  "mcpServers": {
    "stock-analyzer": {
      "command": "/Applications/Stock Analyzer.app/Contents/Resources/app.asar.unpacked/bin/saa-mcp",
      "env": { "PORT": "3000" }
    }
  }
}
```

> **為什麼是 `bin/saa-mcp` 不是 `node`？**
> 以前用 `node mcp-server.js` 會撞 better-sqlite3 ABI mismatch（native binding 為 Electron Node 編，跟系統 Node 不相容），啟動就崩。`bin/saa-mcp` 是 shell wrapper，自動找 SAA 內建的 Electron runtime，加 `ELECTRON_RUN_AS_NODE=1` 跑 mcp-server.js。0.47.2-beta 之前的 config 用 `node` 的話，請更新。

**選用**：加 `SAA_MCP_PROFILE` 限制成 read-only：

```json
{
  "mcpServers": {
    "stock-analyzer": {
      "command": "/Applications/Stock Analyzer.app/Contents/Resources/app.asar.unpacked/bin/saa-mcp",
      "env": { "PORT": "3000", "SAA_MCP_PROFILE": "safe_readonly" }
    }
  }
}
```

`safe_readonly` 自動 skip 15 個 write tool（`add_trade` / `delete_trade` / `upsert_thesis` / `set_price_alert` 等）。給「不完全信任的 LLM client」（共享環境 / 第三方 agent）用。Resources 仍可用（本來就 read-only）。

### 步驟 2：寫入 Claude Desktop config

```bash
# macOS
~/Library/Application Support/Claude/claude_desktop_config.json
```

如果這個檔案不存在，建立它，內容就是步驟 1 複製出來的 JSON。

如果已存在，把 `mcpServers.stock-analyzer` 區塊加進去。

### 步驟 3：完整重啟 Claude Desktop

- macOS：`cmd+Q` 完整離開（**不是關視窗**），再重開
- 第一次啟動時，Claude Desktop 可能會彈出「Allow MCP server "stock-analyzer" to run?」對話框，按允許

### 步驟 4：驗證

在 Claude Desktop 開新對話，輸入：

> 「列出我有哪些 SAA 工具可以用」

Claude 會回 92 個工具的清單。或直接問：

> 「2330 現在報價多少？」

如果 Claude 自動呼叫 `get_stock_price` 並回給你數字，**設定完成**。

進階驗證 — 試 resource：

> 「@saa://system/info 看一下 server 版本」

Claude 應該回類似 `{ server_version: 1.3.0, tool_count: 92, active_profile: default, ... }`。

---

## 4. 92 個工具 + 6 個 Resources 總覽

### 工具（92 個 across 15 分類）

工具按 15 個分類組織（in-app 設定面板 → 「🔍 可用工具」展開查看完整清單）：

| 分類 | 數量 | 代表工具 |
|---|---|---|
| 📈 行情 / 市場 | 14 | `get_stock_price`, `get_market_heatmap`, `get_news`, `compare_stocks` |
| 🏦 籌碼 / 三大法人 | 6 | `get_institutional_flow`, `get_fund_flow_sankey`, `get_chip_flow_overview` |
| 📊 基本面 / 財務 | 6 | `get_fundamentals_from_db`, `get_financial_statements`, `calculate_dcf` |
| 📉 技術指標 | 5 | `get_technical_indicators`, `detect_kline_patterns`, `get_stock_correlation` |
| 🌍 宏觀經濟 | 8 | `get_macro_snapshot`, `get_yield_curve`, `get_fed_policy_stance` |
| 🧠 情緒 / AI | 5 | `analyze_sentiment`, `get_stock_sentiment_v2`, `get_sentiment_forecasts` |
| 💼 投資組合 | 11 | `get_portfolio`, `add_trade`, `analyze_trade_performance` |
| 🧪 回測 | 5 | `backtest_strategy`, `backtest_multi_strategy`, `monte_carlo_factor_mining` |
| ⚠️ 風險 | 6 | `calculate_portfolio_var`, `get_systemic_risk`, `optimize_portfolio`, `get_risk_contribution`, `get_portfolio_stress`, `run_scenario` |
| 🤖 AI 工作流（含 research）| 7 | `get_full_stock_analysis`, `research_stock_deep_dive`, `portfolio_daily_briefing`, `compare_investment_candidates`, `post_trade_review` |
| 📌 投資論點 | 7 | `upsert_thesis`, `list_theses`, `invalidate_thesis`, `evaluate_thesis_quality` |
| ⭐ 關注清單 | 4 | `list_watchlist`, `add_watchlist`, `remove_watchlist` |
| 🔔 股價提醒 | 3 | `set_price_alert`, `list_alerts`, `cancel_alert` |
| 🔄 資料補齊 | 2 | `trigger_backfill`, `trigger_batch_backfill` |
| 🔮 預測 / 校準 | 3 | `get_price_forecast`（GBM 機率錐）, `get_forecast_calibration`（前瞻校準戰績）, `get_preopen_context`（台股盤前脈絡）|
| **總計** | **92** | — |

### Resources（6 個，0.47.2-beta 新增）

在 Claude Desktop 直接打 `@` 提及即可塞 context 進對話（不會吃 tool budget）：

| URI | 內容 |
|---|---|
| `saa://portfolio` | 完整持股（TW + US，USD/TWD 統一計價、未實現損益）|
| `saa://watchlist` | 觀察清單含當前報價 + 警示狀態 |
| `saa://thesis` | 所有 active 投資論點 |
| `saa://market/today` | 今日三大法人 / 產業漲跌 / 系統性風險 / 匯率 |
| `saa://reports/recent` | 最近一次 portfolio 簡報（不會主動跑 LLM）|
| `saa://system/info` | Server 自身資訊（version / profile / tool count）|

對話開頭 `@saa://market/today` 一次可省下 4-5 個 tool call。

### 工具 metadata（0.47.2-beta 起每個工具都帶）

- `annotations.readOnlyHint` — 是否會改 state（destructive tool 如 `delete_trade` 為 false）
- `annotations.destructiveHint` — `delete_*` / `cancel_*` 標 true，Claude Desktop 會跳確認
- `annotations.idempotentHint` — `upsert_*` / `update_*` 標 true（同 args 多呼叫無副作用）
- `_meta.tw.stockanalyzer/estimated_cost_usd` — 該 tool 一次呼叫的 worst-case LLM 成本（多數是 $0，`research_stock_deep_dive` ~$0.16）

---

## 5. License Tier 邊界

92 個工具不是全部「Lite 用戶」都能用 — 部分高耗運算 / 美股 / 進階風險工具需更高 tier：

| Tier | 大致工具範圍 |
|---|---|
| **Lite**（Free） | 台股報價 / 籌碼 / 技術指標 / 投組查詢 / thesis / watchlist / alert / backfill / daily briefing / compare candidates / post-trade review（**約 65 個工具**）|
| **Standard** | 加上：美股全套（quote/chart/fundamentals/analyst/earnings）、進階回測（multi/grid）、投組進階分析（concentration/optimize）|
| **Premium** | 加上：MC 因子挖掘、MC 隨機投組、進階風險（VaR/Systemic risk）、**`research_stock_deep_dive`（5-agent debate）**|

工具被擋時，Claude 會收到 `403 UPGRADE_REQUIRED` 錯誤訊息並轉達。如果你在 Lite 但需要 Premium 工具，請考慮升級。

In-app 設定面板的「🔍 可用工具」每個工具旁邊有 tier badge 直接告知。

---

## 6. 對話範例

### 📊 個股研究

> 「2330 最近 30 天三大法人怎麼買？」
> 「幫我做完整的 NVDA 個股分析」
> 「2454 RSI 跟 KD 現在多少？有什麼 K 棒型態？」
> 「比較 2330、2454、2317 的相關性」

### 🎭 深度研究（0.47.2-beta 新功能，Premium）

> 「對 2330 跑 5-agent 深度研究」（觸發 `research_stock_deep_dive`）
> 「2330 / 2454 / 3008 三檔我在考慮，幫我並排比較深度分析 + 各自 thesis 狀態」（觸發 `compare_investment_candidates`）

### 💼 投組

> 「@saa://portfolio 看一下我目前的投資組合，哪幾檔虧最多？」
> 「我的投組集中度有沒有問題？」
> 「幫我記錄 2330 的投資論點：止損 520、加碼 540、目標 650」
> 「列出我所有有效的投資論點，按距下次檢查日期排序」

### 📓 交易反思（0.47.2-beta 新功能）

> 「過去 30 天我的交易績效幫我做 review」（觸發 `post_trade_review`，自動偵測 low_win_rate / over_trading / lopsided_pnl pattern）
> 「@saa://reports/recent 看最新的 portfolio 簡報」
> 「跑一份新的盤前簡報」（觸發 `portfolio_daily_briefing` mode='generate'）

### 🧪 回測 / 篩選

> 「找出最近一週 RSI < 30 的台股」
> 「對 0050 跑 MA(5/20) 黃金交叉策略回測」
> 「在 50 元以下、本益比 < 15、近 3 月外資淨買超 1 億以上的台股」（多條件篩選）

### 🌍 宏觀 / 籌碼

> 「@saa://market/today 今天大盤狀態怎樣？」
> 「現在 FED 政策立場是什麼？通膨數字看起來怎樣？」
> 「今天三大法人買最多的產業是哪些？」
> 「2330 過去 3 年 8 月平均漲幅多少？」（季節性）

### 🔔 提醒 / 工作流

> 「幫我設一個 2330 突破 600 的提醒」
> 「列出我所有未觸發的價格提醒」
> 「把 NVDA 加入我的關注清單，標籤 AI 加速器」

---

## 7. 故障排除

連不上時依序檢查：

### Q1. SAA 是否在跑？
- 看系統列 icon 是否亮起
- 瀏覽器開 [http://localhost:3000](http://localhost:3000) 應該看得到首頁
- 沒有 → 從 `/Applications` 啟動 Stock Analyzer.app

### Q2. Claude Desktop 看不到 stock-analyzer 工具？
- 確認 `claude_desktop_config.json` 路徑正確：`~/Library/Application Support/Claude/`
- 確認 JSON 的 `command` 指向 `/Applications/Stock Analyzer.app/Contents/Resources/app.asar.unpacked/bin/saa-mcp`（**0.47.2-beta 後**用 wrapper；舊版用 `node` 直跑會撞 ABI mismatch）
- 改完 config **完整重啟 Claude Desktop**（cmd+Q 後再開，不是只關視窗）

### Q3. Claude Desktop 啟動時提示「Allow MCP server ... to run?」
- 點允許。這是 macOS 沙盒對 SAA Electron 執行的詢問
- 如果不小心拒絕了：刪除 `~/Library/Application Support/Claude/claude_desktop_config.json` 中的 stock-analyzer 區塊重來

### Q4. better-sqlite3 ABI mismatch 啟動就崩
- 症狀：Claude Desktop 顯示 stock-analyzer 紅色 / disconnected；MCP server logs 出現 `NODE_MODULE_VERSION 137` vs `145` 之類錯誤
- 起因：用了 `command: "node"` 直接跑，但 better-sqlite3 native binding 為 Electron Node ABI 編譯
- 修：把 config 改用 `bin/saa-mcp` wrapper（見 §3）

### Q5. 收到 403 UPGRADE_REQUIRED？
- 該工具需要更高 tier。看「🔍 可用工具」清單的 tier badge 確認
- 升級 license 後重啟 SAA

### Q6. safe_readonly profile 想啟用 / 解除
- 啟用：config `env` 加 `"SAA_MCP_PROFILE": "safe_readonly"`，重啟 Claude Desktop。tool list 會從 92 降到 77（write tool 被 skip，read tool + 全部 resource 保留）
- 看現在用哪個 profile：`@saa://system/info` → `active_profile` 欄位
- 解除：移除 env 即恢復 `default`

### Q7. macOS 擋下 SAA Electron 執行？
- 第一次跑可能在「系統設定 → 隱私權與安全性」需要放行
- 確認 SAA.app 是 notarized 版（不是 dev build）：
  ```bash
  spctl -a -vvv /Applications/Stock\ Analyzer.app
  ```
  應該回 `accepted, source=Notarized Developer ID`

### Q8. 以上都檢查過仍連不上
- SAA 設定面板 → 系統診斷區塊截圖
- 把截圖 + Claude Desktop 的「Help → View Logs」logs 一起回報

---

## 8. 進階：從 terminal CLI 直呼工具

不想開 Claude Desktop？用 `saa-tool` CLI：

```bash
# 列出全部工具
saa-tool list

# 拉投資組合
saa-tool get_portfolio --pretty

# 個股報價（key=value 參數，自動推斷型別）
saa-tool get_stock_price code=2330

# 物件參數用 JSON 字串
saa-tool upsert_thesis stockId=2330 market=TW \
  key_levels='{"entry":580,"target":650,"stopLoss":520}' \
  tags='["長線","核心持股"]'

# 看單一工具的完整參數說明
saa-tool upsert_thesis --help
```

裝 global binary：

```bash
# 在 SAA 專案根目錄
npm install -g .

# 之後可以從任何 terminal 跑
saa-tool list
saa-tool get_portfolio
```

**前提**：SAA app 必須在跑（CLI 透過 localhost:3000 內部 API 呼叫工具）。

> **遠端 HTTP transport（cross-machine）目前未實作。** 之前的版本曾規劃 bearer-token + `/mcp` HTTP endpoint，但實際只有 stdio。如果你需要從別台機器接 SAA，目前要在那台機器自己跑一份 SAA app，或等 future HTTP/SSE transport（在 roadmap 上）。

---

## 9. 參考

- 設定面板：SAA → 設定 → 🔌 MCP / Agent 連接
- 工具 source：[`lib/ai-tools/tools/`](../lib/ai-tools/) — 14 個分類模組
- Tier mapping：[`lib/ai-tools/tier-map.js`](../lib/ai-tools/tier-map.js)
- API：[`routes/ai.js`](../routes/ai.js) `/api/mcp/info` + `/api/mcp/tools`
- MCP 協議官方：[modelcontextprotocol.io](https://modelcontextprotocol.io)
- 相關 ADR：[ADR-data-sources.md](./ADR-data-sources.md)

---

## 10. Find Us On (MCP Marketplaces)

Stock Analyzer 的 MCP server 是 2026 年**唯一深度覆蓋台股的 MCP 選項**。如果你在以下 marketplace 找 finance / stock-market MCP server，可以找到我們：

- **awesome-mcp-servers** (GitHub) — [`punkpeye/awesome-mcp-servers`](https://github.com/punkpeye/awesome-mcp-servers) Finance section
- **mcpservers.org** — [listing](https://mcpservers.org) (community-aggregated)
- **PulseMCP** — [pulsemcp.com](https://www.pulsemcp.com)

跟同類 MCP server 的對比：

| Server | TW coverage | US coverage | Local | License |
|---|---|---|---|---|
| Alpha Vantage MCP | ⚠️ 僅延遲報價 | ✅ Full | ❌ Cloud | Pay per call |
| Financial Datasets MCP | ❌ None | ✅ Full | ❌ Cloud | Subscription |
| EODHD MCP | ⚠️ 僅 EOD | ✅ Full | ❌ Cloud | Subscription |
| Lambda Finance | ❌ None | ✅ Full + options | ❌ Cloud | Subscription |
| **Stock Analyzer MCP** | ✅ **TWSE + TPEx + 三大法人 + 籌碼 + 月營收** | ✅ Full | ✅ **Local SQLite** | NT$0-2999 (一次性) |

讀完整 launch blog：[`docs/mcp-launch-2026-05.md`](./docs/mcp-launch-2026-05.md)（雙語）。

---

## 11. 更新紀錄

- **2026-05-18 (SAA 0.47.2-beta / MCP v1.2.0)**：
  - 6 個 MCP Resources（`@`-mention 即用）
  - 2 個 LLM-backed tool（`research_stock_deep_dive` Premium / `portfolio_daily_briefing` Lite）
  - 2 個 deterministic aggregator（`compare_investment_candidates` / `post_trade_review`，cost $0）
  - `safe_readonly` profile（block 15 write tools）
  - Tool metadata：`annotations` + `_meta.estimated_cost_usd`
  - **`bin/saa-mcp` wrapper script** — 取代直接 `node mcp-server.js`，解決 better-sqlite3 ABI mismatch
  - 修復 schema converter（type:"object" 參數之前被當字串拒）
- **2026-05-11 (SAA 0.47.0-beta / MCP v1.0.0)**：MCP server 初版，81 工具，提交到 3 個 marketplace
