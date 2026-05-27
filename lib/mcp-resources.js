// ============================================
// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
// MCP Resources for SAA
//
// 2026-05-18 Sprint B：除 tools 外，補上 5 個 Resources。
//
// 為什麼要 Resources：
//   Tools 是 LLM 主動呼叫的 function；Resources 是用戶 "@" mention 就能塞進 context
//   的「狀態快照」。例如 user 在 Claude Desktop 打 "@saa://portfolio 幫我看下風險"，
//   不用走 tool 就把當前 portfolio 全部丟給 LLM。對 daily workflow 很有用。
//
// 設計：
//   - 每個 resource = static URI（無 template），避開複雜化
//   - readCallback 直接呼叫對應的 EXECUTOR（重用 tool layer，DRY）
//   - 用 application/json mimeType；client 自己 parse
//   - Wrap 在 try/catch，error 也回合法的 contents（避免 client 炸掉）
//
// 未來擴充：
//   - saa://stock/{code} template resource — 單檔深度資料
//   - saa://alerts/active template — 啟用中的價格警示
// ============================================
'use strict';

/**
 * @typedef {Object} ResourceDef
 * @property {string} name           短名稱（給 client UI 看的）
 * @property {string} uri            完整 URI
 * @property {string} title          人類可讀標題
 * @property {string} description    描述（給 LLM 知道何時引用）
 * @property {string} mimeType       application/json
 * @property {() => Promise<any>} read  讀資料的 callback（回 JSON-serialisable）
 */

// ============================================
// Server schema version — bump when tool shapes break backward compat
// 不同於 mcp-server.js 的 `version`：
//   server version (1.x.y) = SAA MCP binary 版本（隨 SAA app 升）
//   tools_schema_version   = tool definitions 結構性版本（client 用來決定要不要 invalidate）
// 升版規則：
//   - patch: 新增 tool / resource（向下相容）
//   - minor: 新增 tool 必填參數 / 新增 enum 限制 / readOnlyHint 變動
//   - major: 改 tool name / 刪 tool / 改 required keys
// ============================================
// 1.2.1 (2026-05-21)：+ saa://memory/{stockId} template resource（patch — additive）
const TOOLS_SCHEMA_VERSION = '1.2.1';

/**
 * Build the starter resource defs.
 * @param {{ executeTool: (name: string, args?: object) => Promise<any>, getToolDefinitions: () => Array }} aiTools
 * @param {{ profileName?: string, serverVersion?: string }} ctx
 * @returns {ResourceDef[]}
 */
function buildResources(aiTools, ctx = {}) {
  return [
    {
      name: 'portfolio',
      uri: 'saa://portfolio',
      title: '當前投資組合 / Current Portfolio',
      description: '台股 + 美股完整 portfolio snapshot（含 USD/TWD 統一計價、未實現損益、產業集中度）。用於回答「我現在持有什麼」「總體曝險」這類問題，不需 LLM 額外查。',
      mimeType: 'application/json',
      read: async () => aiTools.executeTool('get_portfolio', { market: 'all' }),
    },
    {
      name: 'watchlist',
      uri: 'saa://watchlist',
      title: '觀察清單 / Watchlist',
      description: '所有自選股清單（TW + US）含當前報價、價格警示狀態。"@watchlist 哪幾檔今天動最多" 之類用得到。',
      mimeType: 'application/json',
      read: async () => aiTools.executeTool('list_watchlist', {}),
    },
    {
      name: 'thesis',
      uri: 'saa://thesis',
      title: '投資論點 / Investment Theses',
      description: '所有 active 的投資論點（含 hypothesis / key levels / risk conditions / next review date）。"@thesis 哪些到了該 review 的時間" 直接 mention 即可。',
      mimeType: 'application/json',
      read: async () => aiTools.executeTool('list_theses', { activeOnly: true }),
    },
    {
      name: 'market-today',
      uri: 'saa://market/today',
      title: '今日大盤狀態 / Market Today',
      description: '當日 TWSE 三大法人 / 產業漲跌前五 / 系統性風險 / USD/TWD 匯率 — 即時 market context。對話開頭 mention 一次可省下 4-5 個 tool call。',
      mimeType: 'application/json',
      read: async () => aiTools.executeTool('get_market_overview', {}),
    },
    {
      name: 'briefing-latest',
      uri: 'saa://reports/recent',
      title: '最新 portfolio 簡報 / Latest Briefing',
      description: '最近一次 portfolio 簡報（盤前 morning，若無則回 empty 提示生成）。不會主動跑 LLM — 純讀已存在的快照。',
      mimeType: 'application/json',
      read: async () => aiTools.executeTool('portfolio_daily_briefing', { type: 'morning', mode: 'get' }),
    },
    {
      // 2026-05-18 Sprint C — 給 client 一個 stable introspection endpoint
      name: 'system-info',
      uri: 'saa://system/info',
      title: 'MCP server info / 系統資訊',
      description: 'SAA MCP server 基本資訊：server version / tools schema version / active profile / tool & resource count / 是否可連到內部 API。Client 用來偵測升版 / debug 連線。',
      mimeType: 'application/json',
      read: async () => {
        const defs = aiTools.getToolDefinitions ? aiTools.getToolDefinitions() : [];
        return {
          server_version: ctx.serverVersion || 'unknown',
          tools_schema_version: TOOLS_SCHEMA_VERSION,
          active_profile: ctx.profileName || 'default',
          tool_count: defs.length,
          resource_count: 6, // self-reference; bump if you add resources
          repo: 'https://github.com/kevinlin49361128-stack/stock-analyzer-mcp',
          docs: 'https://stockanalyzer.tw',
          generated_at: new Date().toISOString(),
        };
      },
    },
  ];
}

/**
 * Template resource defs（URI 含變數 — SAA 第一個 template resource）。
 * 2026-05-21 Phase 2：saa://memory/{stockId} 暴露 Investor Memory 給外部 agent。
 * @returns {Array<{name, uriTemplate, title, description, mimeType, read}>}
 *   read 簽名為 (variables) => data
 */
function buildTemplateResources() {
  const investorMemory = (() => {
    try { return require('./investor-memory'); } catch { return null; }
  })();
  return [
    {
      name: 'memory',
      uriTemplate: 'saa://memory/{stockId}',
      title: '使用者對個股的記憶 / Investor memory for a stock',
      description: '使用者對某支股票的既有脈絡：投資論點、持倉、近期交易、過去 AI 判斷、分析筆記。市場預設 TW；美股用 saa://memory/AAPL 之類（自動偵測）。讓外部 agent 在分析前先 @ 到「使用者已知的事」。',
      mimeType: 'application/json',
      read: (variables) => {
        if (!investorMemory) return { error: 'investor-memory unavailable' };
        const raw = String(variables.stockId || '').trim();
        if (!raw) return { error: 'stockId required' };
        // 粗略市場偵測：純數字 = TW，否則 US（與 SAA 其他工具一致的慣例）
        const market = /^\d+[A-Z]?$/.test(raw) ? 'TW' : 'US';
        return investorMemory.getMemoryFor({ stockId: raw, market });
      },
    },
  ];
}

/**
 * Wrap resource data into MCP ReadResourceResult shape
 */
function toResourceContents(uri, data) {
  return {
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(data, null, 2),
    }],
  };
}

module.exports = { buildResources, buildTemplateResources, toResourceContents, TOOLS_SCHEMA_VERSION };
