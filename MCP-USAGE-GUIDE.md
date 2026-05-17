# SAA MCP 使用教學

**對象**：想把 Claude Desktop / Claude Code / 自家 agent 接上 SAA 的用戶。

**最後更新**：2026-05-11

---

## 1. 什麼是 MCP？

**Model Context Protocol（MCP）** 是 Anthropic 開源的協議，讓 AI 助理（Claude / GPT / Gemini 等）可以呼叫外部工具。SAA 把 80 個分析工具（個股報價、籌碼、財報、回測、AI 篩選…）透過 MCP 開放給 AI 用。

接上後，你可以在 Claude Desktop 用自然語言對話：

> 「2330 最近三大法人怎麼買？」
> 「我的投資組合風險集中度怎樣？」
> 「找出最近一週 RSI < 30 的台股」

Claude 自動選擇對應的 SAA 工具、傳參、把結果整合成回答。

---

## 2. 兩種連線模式

| 模式 | 用途 | 需要 Token | 設定方式 |
|---|---|---|---|
| **本機 stdio** | Claude Desktop App（同一台 Mac）| ❌ 免 | `claude_desktop_config.json` |
| **遠端 HTTP** | 外部 agent / 自家腳本 / 跨機器 | ✅ Agent Token | HTTP header `Authorization: Bearer <token>` |

---

## 3. 設定 Claude Desktop（最常見的場景）

### 步驟 1：取得 SAA 設定 JSON

在 SAA 內：
1. 開啟設定面板（左側 sidebar → 🛠️ 設定）
2. 找「🔌 MCP / Agent 連接」區塊
3. 點 **「📋 複製設定」** 按鈕

複製出來的 JSON 大致長這樣：

```json
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

Claude 會回 80 個工具的清單。或直接問：

> 「2330 現在報價多少？」

如果 Claude 自動呼叫 `get_stock_price` 並回給你數字，**設定完成**。

---

## 4. 80 個工具總覽

工具按 14 個分類組織（in-app 設定面板 → 「🔍 80 個可用工具」展開查看完整清單）：

| 分類 | 數量 | 代表工具 |
|---|---|---|
| 📈 行情 / 市場 | 12 | `get_stock_price`, `get_market_heatmap`, `get_news`, `compare_stocks` |
| 🏦 籌碼 / 三大法人 | 6 | `get_institutional_flow`, `get_fund_flow_sankey`, `get_chip_flow_overview` |
| 📊 基本面 / 財務 | 6 | `get_fundamentals_from_db`, `get_financial_statements`, `calculate_dcf` |
| 📉 技術指標 | 5 | `get_technical_indicators`, `detect_kline_patterns`, `get_stock_correlation` |
| 🌍 宏觀經濟 | 8 | `get_macro_snapshot`, `get_yield_curve`, `get_fed_policy_stance` |
| 🧠 情緒 / AI | 5 | `analyze_sentiment`, `get_stock_sentiment_v2`, `get_sentiment_forecasts` |
| 💼 投資組合 | 11 | `get_portfolio`, `add_trade`, `analyze_trade_performance` |
| 🧪 回測 | 5 | `backtest_strategy`, `backtest_multi_strategy`, `monte_carlo_factor_mining` |
| ⚠️ 風險 | 3 | `calculate_portfolio_var`, `get_systemic_risk`, `optimize_portfolio` |
| 🤖 AI 工作流 | 4 | `get_full_stock_analysis`, `screen_stocks`, `create_analysis_workflow` |
| 📌 投資論點 | 6 | `upsert_thesis`, `list_theses`, `invalidate_thesis` |
| ⭐ 關注清單 | 4 | `list_watchlist`, `add_watchlist`, `remove_watchlist` |
| 🔔 股價提醒 | 3 | `set_price_alert`, `list_alerts`, `cancel_alert` |
| 🔄 資料補齊 | 2 | `trigger_backfill`, `trigger_batch_backfill` |
| **總計** | **80** | — |

---

## 5. License Tier 邊界

80 個工具不是全部「Lite 用戶」都能用 — 部分高耗運算 / 美股 / 進階風險工具需更高 tier：

| Tier | 大致工具範圍 |
|---|---|
| **Lite**（Free） | 台股報價 / 籌碼 / 技術指標 / 投組查詢 / thesis / watchlist / alert / backfill（**約 60 個工具**）|
| **Standard** | 加上：美股全套（quote/chart/fundamentals/analyst/earnings）、進階回測（multi/grid）、投組進階分析（concentration/optimize）|
| **Premium** | 加上：MC 因子挖掘、MC 隨機投組、進階風險（VaR/Systemic risk）|

工具被擋時，Claude 會收到 `403 UPGRADE_REQUIRED` 錯誤訊息並轉達。如果你在 Lite 但需要 Premium 工具，請考慮升級。

In-app 設定面板的「🔍 80 個可用工具」每個工具旁邊有 tier badge 直接告知。

---

## 6. 對話範例

### 📊 個股研究

> 「2330 最近 30 天三大法人怎麼買？」
> 「幫我做完整的 NVDA 個股分析」
> 「2454 RSI 跟 KD 現在多少？有什麼 K 棒型態？」
> 「比較 2330、2454、2317 的相關性」

### 💼 投組

> 「看一下我目前的投資組合，哪幾檔虧最多？」
> 「我的投組集中度有沒有問題？」
> 「幫我記錄 2330 的投資論點：止損 520、加碼 540、目標 650」
> 「列出我所有有效的投資論點，按距下次檢查日期排序」

### 🧪 回測 / 篩選

> 「找出最近一週 RSI < 30 的台股」
> 「對 0050 跑 MA(5/20) 黃金交叉策略回測」
> 「在 50 元以下、本益比 < 15、近 3 月外資淨買超 1 億以上的台股」（多條件篩選）

### 🌍 宏觀 / 籌碼

> 「現在 FED 政策立場是什麼？通膨數字看起來怎樣？」
> 「今天三大法人買最多的產業是哪些？」
> 「2330 過去 3 年 8 月平均漲幅多少？」（季節性）

### 🔔 提醒 / 工作流

> 「幫我設一個 2330 突破 600 的提醒」
> 「列出我所有未觸發的價格提醒」
> 「把 NVDA 加入我的關注清單，標籤 AI 加速器」

---

## 7. saa-tool CLI（terminal 直呼工具）

不想開 Claude Desktop？terminal 也能直接呼叫 80 個工具：

```bash
# 列出全部工具
npm run tool list

# 拉投資組合
npm run tool get_portfolio --pretty

# 個股報價（key=value 參數，自動推斷型別）
npm run tool get_stock_price code=2330

# 物件參數用 JSON 字串
npm run tool upsert_thesis stockId=2330 market=TW \
  key_levels='{"entry":580,"target":650,"stopLoss":520}' \
  tags='["長線","核心持股"]'

# 看單一工具的完整參數說明
npm run tool upsert_thesis --help

# 一行 JSON 輸出（pipe 給 jq 處理）
npm run tool get_portfolio --raw | jq '.twStocks | length'
```

或裝成 global binary：

```bash
# 在 SAA 專案根目錄
npm install -g .

# 之後可以從任何 terminal 跑
saa-tool list
saa-tool get_portfolio
```

**前提**：SAA 必須在跑（CLI 透過 localhost:3000 內部 API 呼叫 80 個工具）。

---

## 8. 故障排除

連不上時依序檢查：

### Q1. SAA 是否在跑？
- 看系統列 icon 是否亮起
- 瀏覽器開 [http://localhost:3000](http://localhost:3000) 應該看得到首頁
- 沒有 → 從 `/Applications` 啟動 Stock Analyzer.app

### Q2. Claude Desktop 看不到 stock-analyzer 工具？
- 確認 `claude_desktop_config.json` 路徑正確：`~/Library/Application Support/Claude/`
- 確認 JSON 的 `args` 內的 `mcp-server.js` **絕對路徑**仍有效（macOS 重新安裝 SAA 後路徑可能變）
- 改完 config **完整重啟 Claude Desktop**（cmd+Q 後再開，不是只關視窗）

### Q3. Claude Desktop 啟動時提示「Allow MCP server ... to run?」
- 點允許。這是 macOS 沙盒對 node 執行的詢問
- 如果不小心拒絕了：刪除 `~/Library/Application Support/Claude/claude_desktop_config.json` 中的 stock-analyzer 區塊重來

### Q4. HTTP Agent 模式收到 401 Unauthorized？
- Token 過期了 → 到 SAA 設定面板「Agent Token 清單」看「到期」欄
- Token 寫錯 → 重新複製，注意 `Authorization: Bearer ` 後面有空格
- Token 已 revoke → 重建一個

### Q5. 收到 403 UPGRADE_REQUIRED？
- 該工具需要更高 tier。看「🔍 80 個可用工具」清單的 tier badge 確認
- 升級 license 後重啟 SAA

### Q6. macOS 擋下 node 執行？
- 第一次跑可能在「系統設定 → 隱私權與安全性」需要放行
- 確認 SAA.app 是 notarized 版（不是 dev build）：
  ```bash
  spctl -a -vvv /Applications/Stock\ Analyzer.app
  ```
  應該回 `accepted, source=Notarized Developer ID`

### Q7. 以上都檢查過仍連不上
- SAA 設定面板 → 系統診斷區塊截圖
- 把截圖 + Claude Desktop 的「Help → View Logs」logs 一起回報

---

## 9. 進階：用 HTTP API 自家整合

如果你有自家 agent / Python 腳本想接：

```bash
# 1. 建 Agent Token（in-app 設定面板）
# 2. 直接呼叫 HTTP endpoint
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"get_stock_price","args":{"code":"2330"}}'
```

Python 範例：

```python
import requests

TOKEN = "your-agent-token"
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

## 10. 參考

- 設定面板：SAA → 設定 → 🔌 MCP / Agent 連接
- 工具 source：[`lib/ai-tools/tools/`](../lib/ai-tools/) — 14 個分類模組
- Tier mapping：[`lib/ai-tools/tier-map.js`](../lib/ai-tools/tier-map.js)
- API：[`routes/ai.js`](../routes/ai.js) `/api/mcp/info` + `/api/mcp/tools`
- MCP 協議官方：[modelcontextprotocol.io](https://modelcontextprotocol.io)
- 相關 ADR：[ADR-data-sources.md](./ADR-data-sources.md)

---

## 11. Find Us On (MCP Marketplaces)

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

讀完整 launch blog：[`docs/blog/mcp-launch-2026-05.md`](./blog/mcp-launch-2026-05.md)（雙語）。
