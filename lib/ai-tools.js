// ============================================
// Copyright (c) 2025-2026 Kevin Lin. All rights reserved.
// AI Tool Registry — Public API
// (split into lib/ai-tools/tools/* by scripts/split-ai-tools.js, 2026-05-10)
// ============================================

'use strict';

const modules = [
  require('./ai-tools/tools/market'),
  require('./ai-tools/tools/chips'),
  require('./ai-tools/tools/fundamentals'),
  require('./ai-tools/tools/technical'),
  require('./ai-tools/tools/macro'),
  require('./ai-tools/tools/sentiment'),
  require('./ai-tools/tools/portfolio'),
  require('./ai-tools/tools/backtest'),
  require('./ai-tools/tools/risk'),
  require('./ai-tools/tools/ai'),
  require('./ai-tools/tools/thesis'),
  require('./ai-tools/tools/watchlist'),
  require('./ai-tools/tools/alert'),
  require('./ai-tools/tools/backfill'),
  // 2026-05-18 Sprint B: LLM-backed aggregator tools（multi-agent / daily briefing）
  require('./ai-tools/tools/research'),
  // 2026-06-30: 近期分析波曝光 MCP（機率錐 / 前瞻校準帳本 / 盤前脈絡 / 情境壓力）
  require('./ai-tools/tools/forecast'),
];

const TOOL_DEFINITIONS = modules.flatMap(m => m.definitions);
const EXECUTORS = Object.assign({}, ...modules.map(m => m.executors));

// 2026-05-16: 把 EXECUTORS 注入 helpers.registry，讓 child tool modules 可以 cross-call
// （get_full_stock_analysis / create_analysis_workflow / get_market_overview 用到）
const { registry } = require('./ai-tools/helpers');
Object.assign(registry, EXECUTORS);

// ============================================
// Tool Execution with Timeout Protection
// ============================================

const TOOL_TIMEOUT_MS = 30000; // 預設 30 秒防止 LLM/外部服務掛起
const TOOL_CACHE_TTL = 30 * 1000; // 30 秒結果快取，避免同一問題重複呼叫 API
const _toolCache = new Map();

// ── 逐工具 timeout 覆寫（2026-06-14 修：MCP 長回測截斷）──────────────
// 慢工具 executor 內層已宣告自己需要的 timeout（grid/multi 60s、MC factor 90s…），
// 但外層 30s race 永遠先殺 → 內層宣告全成死信，MCP 客端跑回測必 timeout。
// 解：外層 guard 改逐工具，設成「內層宣告 + 緩衝」，讓內層 timeout 先觸發
//（回乾淨的「後端慢」錯誤）而非外層假死。值對齊各 executor 的 *Internal timeout。
const TOOL_TIMEOUT_OVERRIDES = {
  backtest_strategy:            45000,  // inner fetch 30s
  backtest_grid_search:         75000,  // inner 60s
  backtest_multi_strategy:      75000,  // inner 60s
  monte_carlo_random_portfolio: 75000,  // inner 60s
  monte_carlo_factor_mining:   110000,  // inner 90s
  screen_stocks:                60000,  // inner 45s
  portfolio_daily_briefing:     75000,  // inner 60s
  get_portfolio_performance:    60000,  // inner 45s
};
const MAX_TOOL_TIMEOUT_MS = 180000; // 硬上限，避免單一工具卡死整條 stdio 管線

function _resolveToolTimeout(name) {
  const override = TOOL_TIMEOUT_OVERRIDES[name];
  if (override && Number.isFinite(override)) return Math.min(override, MAX_TOOL_TIMEOUT_MS);
  return TOOL_TIMEOUT_MS;
}

/**
 * Execute a tool call by name (逐工具 timeout guard + 30s result cache)
 */
async function executeTool(name, args) {
  const executor = EXECUTORS[name];
  if (!executor) {
    return { error: `Unknown tool: ${name}` };
  }

  const cacheKey = `${name}:${JSON.stringify(args)}`;
  const cached = _toolCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.result;

  const timeoutMs = _resolveToolTimeout(name);
  try {
    const result = await Promise.race([
      executor(args),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Tool '${name}' timeout after ${timeoutMs / 1000}s`)), timeoutMs)
      ),
    ]);
    if (!result.error) {
      _toolCache.set(cacheKey, { result, expires: Date.now() + TOOL_CACHE_TTL });
    }
    // 注意：provenance 信封改掛在「MCP 回應邊界」（mcp-server.js），不在此處——
    // 因 executeTool 被內部 LLM 消費端共用（ai-monitor/ai-report/multi-agent/chat），不該付 token 稅。
    return result;
  } catch (e) {
    console.warn(`⚠️  [ai-tools] executeTool('${name}') failed: ${e.message}`);
    return { error: `Tool execution failed: ${e.message}` };
  }
}

function getToolDefinitions() {
  return TOOL_DEFINITIONS;
}

module.exports = { getToolDefinitions, executeTool, EXECUTORS, _resolveToolTimeout, TOOL_TIMEOUT_OVERRIDES };
