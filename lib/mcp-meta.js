// ============================================
// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
// MCP tool metadata — read/write classification + cost hints
//
// 2026-05-18 Sprint B：給 MCP tools 配 metadata，讓 MCP clients 能
//   (a) 區分 read-only vs write 操作 → annotations.readOnlyHint
//   (b) 對 cost-sensitive tool 給 user 警告 → _meta.estimated_cost_usd
//
// 設計：以「明確 write」為白名單（小集合 + 容易維護），其餘預設 read-only。
// Cost：絕大多數 tool 都是 free（內部 HTTP fetch），只有 LLM-backed tool 才標。
// ============================================
'use strict';

// 明確的 write / destructive tool（會改 DB 或外部 state）
const WRITE_TOOLS = new Set([
  // Trade Journal
  'add_trade', 'update_trade', 'delete_trade', 'save_analysis_note',
  // Watchlist
  'add_watchlist', 'remove_watchlist', 'update_watchlist',
  // Thesis
  'upsert_thesis', 'invalidate_thesis', 'reactivate_thesis', 'delete_thesis',
  // Alerts
  'set_price_alert', 'cancel_alert',
  // Backfill (kicks off background job — side effect)
  'trigger_backfill', 'trigger_batch_backfill',
]);

// destructive subset of WRITE_TOOLS（不可逆 / 真的會刪 data）
const DESTRUCTIVE_TOOLS = new Set([
  'delete_trade', 'delete_thesis',
  'remove_watchlist',
  'cancel_alert',
]);

// idempotent writes（重複呼叫等價）
const IDEMPOTENT_WRITES = new Set([
  'upsert_thesis',         // upsert 本來就 idempotent
  'update_trade',          // 同樣 args 再呼一次仍是同一筆
  'update_watchlist',
  'set_price_alert',
]);

// LLM-backed / 高 token cost 的 tool — 給 user $ 心理預期
// （SAA 本身用 LLM 的 tool 只有少數，多數透過 internal HTTP / SQLite）
// 數值是「最壞情況下 per-call 約略 USD」— 給 Anthropic / OpenAI 的 LLM 預估
const COST_MAP = {
  // Multi-Agent: 5 agents 並行，每個吃 ~3-5k tokens input + ~1-2k output
  // 用 Claude Sonnet 4 估：(5×4000×$3 + 5×1500×$15) / 1M ≈ $0.16
  'research_stock_deep_dive': 0.16,
  // Daily briefing: 1 個 LLM call + portfolio context ~5k tokens
  'portfolio_daily_briefing': 0.04,
  // 個股深度分析（含 LLM 摘要）
  'analyze_sentiment': 0.02,
  // 其他 tool default = 0（free）
};

function isReadOnly(toolName) {
  return !WRITE_TOOLS.has(toolName);
}

function isDestructive(toolName) {
  return DESTRUCTIVE_TOOLS.has(toolName);
}

function isIdempotent(toolName) {
  return !WRITE_TOOLS.has(toolName) || IDEMPOTENT_WRITES.has(toolName);
}

/**
 * Build the MCP annotations object for a tool.
 * 符合 ToolAnnotationsSchema（readOnlyHint / destructiveHint / idempotentHint）
 */
function getAnnotations(toolName) {
  const readOnly = isReadOnly(toolName);
  return {
    readOnlyHint: readOnly,
    destructiveHint: readOnly ? false : isDestructive(toolName),
    idempotentHint: isIdempotent(toolName),
    // openWorldHint: 我們的 tool 都是 deterministic SQLite/API query，
    // 不打 open-world LLM/web search，留預設 false
  };
}

/**
 * Build the _meta object — custom non-standard metadata for clients
 * 用 reverse-DNS namespace 避開未來 spec 衝突
 */
function getMeta(toolName) {
  const cost = COST_MAP[toolName] || 0;
  return {
    'tw.stockanalyzer/estimated_cost_usd': cost,
    'tw.stockanalyzer/cost_currency': 'USD',
    // free tool 也明示，避免使用者誤以為「沒寫 = 沒測過」
    'tw.stockanalyzer/cost_basis': cost === 0
      ? 'free (internal API only, no LLM)'
      : 'LLM tokens (Anthropic/OpenAI), worst-case per-call estimate',
  };
}

module.exports = {
  WRITE_TOOLS, DESTRUCTIVE_TOOLS, IDEMPOTENT_WRITES, COST_MAP,
  isReadOnly, isDestructive, isIdempotent,
  getAnnotations, getMeta,
};
