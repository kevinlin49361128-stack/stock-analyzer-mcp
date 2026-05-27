// ============================================
// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
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

const TOOL_TIMEOUT_MS = 30000; // 30 秒防止 LLM/外部服務掛起
const TOOL_CACHE_TTL = 30 * 1000; // 30 秒結果快取，避免同一問題重複呼叫 API
const _toolCache = new Map();

/**
 * Execute a tool call by name (with 30s timeout guard + 30s result cache)
 */
async function executeTool(name, args) {
  const executor = EXECUTORS[name];
  if (!executor) {
    return { error: `Unknown tool: ${name}` };
  }

  const cacheKey = `${name}:${JSON.stringify(args)}`;
  const cached = _toolCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.result;

  try {
    const result = await Promise.race([
      executor(args),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Tool '${name}' timeout after ${TOOL_TIMEOUT_MS / 1000}s`)), TOOL_TIMEOUT_MS)
      ),
    ]);
    if (!result.error) {
      _toolCache.set(cacheKey, { result, expires: Date.now() + TOOL_CACHE_TTL });
    }
    return result;
  } catch (e) {
    console.warn(`⚠️  [ai-tools] executeTool('${name}') failed: ${e.message}`);
    return { error: `Tool execution failed: ${e.message}` };
  }
}

function getToolDefinitions() {
  return TOOL_DEFINITIONS;
}

module.exports = { getToolDefinitions, executeTool, EXECUTORS };
