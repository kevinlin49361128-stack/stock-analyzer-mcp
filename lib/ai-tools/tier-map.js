// ============================================
// Copyright (c) 2025-2026 Kevin Lin. All rights reserved.
// AI Tools — License tier mapping
//
// 對應 lib/feature-gate.js 的 routes 端 requireTier()。
// 用途：
//   1. MCP/AI Hub 工具清單 UI 顯示 tier badge
//   2. 給 /api/mcp/tools 端點回傳
//   3. 用戶在低 tier 時提前知道哪些工具會被擋
//
// 注意：實際 gating 在 routes/ 的 requireTier middleware，這份僅供顯示。
// 如果這裡跟 routes/ 不一致，以 routes/ 為準（用戶會看到 403 UPGRADE_REQUIRED）。
// ============================================

'use strict';

// tier 順序：lite (free) < standard < premium
const TIER_BY_TOOL = {
  // ───── market (12) ─────
  get_stock_price:        'lite',     // TW realtime quote
  get_us_stock_quote:     'standard', // routes/quotes.js /api/us/quote requireTier('standard')
  get_price_history:      'lite',     // 看 market 參數；TW 免費、US 進 standard 路徑
  get_market_heatmap:     'lite',
  get_market_overview:    'lite',
  get_trading_day_status: 'lite',     // W5 契約測試抓到的漏登記（2026-06-10）
  get_sector_ranking:     'lite',
  get_news:               'lite',
  get_exchange_rate:      'lite',
  get_seasonality:        'lite',
  compare_stocks:         'lite',
  get_stock_radar:        'lite',
  get_etf_holdings:       'lite',

  // ───── chips (6) ─────
  get_institutional_flow: 'lite',
  get_fund_flow_sankey:   'lite',
  get_chip_flow_overview: 'lite',
  get_margin_ranking:     'lite',
  get_abnormal_blocks:    'lite',
  get_insider_alerts:     'lite',

  // ───── fundamentals (6) ─────
  get_fundamentals_from_db: 'lite',
  get_financial_statements: 'lite',
  get_monthly_revenue:      'lite',
  get_dividend_info:        'lite',
  get_stock_eps:            'lite',
  calculate_dcf:            'lite',

  // ───── technical (5) ─────
  get_technical_indicators: 'lite',
  detect_kline_patterns:    'lite',
  get_trading_levels:       'lite',
  get_stock_correlation:    'lite',
  get_stock_beta:           'lite',

  // ───── macro (8) ─────
  get_macro_snapshot:    'lite',
  get_macro_inflation:   'lite',
  get_macro_employment:  'lite',
  get_macro_series:      'lite',
  get_yield_curve:       'lite',
  get_fed_policy_stance: 'lite',
  get_financial_events:  'lite',
  get_earnings_calendar: 'lite',

  // ───── sentiment (5) ─────
  analyze_sentiment:              'lite',
  get_market_sentiment:           'lite',
  get_stock_sentiment_v2:         'lite',
  get_sentiment_forecasts:        'lite',
  get_sentiment_entry_strategies: 'lite',

  // ───── portfolio (11) ─────
  get_portfolio:               'lite',
  get_pnl_realized:            'lite',
  get_portfolio_performance:   'lite',
  get_portfolio_score:         'lite',
  get_portfolio_concentration: 'standard', // 內部用到 sunburst/attribution（standard gated）
  get_portfolio_signals:       'lite',
  add_trade:                   'lite',
  update_trade:                'lite',
  delete_trade:                'lite',
  get_trade_journal:           'lite',
  analyze_trade_performance:   'lite',

  // ───── backtest (5) ─────
  backtest_strategy:           'lite',      // v1 單檔免費
  backtest_multi_strategy:     'standard',  // routes/backtest.js /api/backtest/multi
  backtest_grid_search:        'standard',
  monte_carlo_factor_mining:   'premium',
  monte_carlo_random_portfolio:'premium',

  // ───── risk (3) ─────
  calculate_portfolio_var: 'premium',  // /api/portfolio/parametric-var
  get_systemic_risk:       'premium',  // /api/systemic-risk
  get_portfolio_stress:    'premium',  // W32 — lib/portfolio-stress（與 stress-test route 同 tier）
  get_risk_contribution:   'premium',  // I4 — lib/risk-contribution（與 risk-contribution route 同 tier）
  optimize_portfolio:      'standard',

  // ───── ai workflow (4 + 2) ─────
  get_full_stock_analysis:   'lite',  // 內部多源並發；gated endpoint 失敗會 graceful degrade
  screen_stocks:             'lite',
  create_analysis_workflow:  'lite',
  save_analysis_note:        'lite',
  // 2026-05-18 Sprint B
  research_stock_deep_dive:  'premium',  // /api/ai/multi-agent-analyze requireTier('premium')
  portfolio_daily_briefing:  'lite',     // /api/briefing/* 沒設 tier gate；LLM cost 用 _meta 標
  // 2026-05-18 Sprint C — 純並行 fetch + 結構化，無 LLM
  compare_investment_candidates: 'lite',
  post_trade_review:             'lite',

  // ───── thesis (6) — 全 lite ─────
  list_theses:        'lite',
  get_thesis:         'lite',
  evaluate_thesis_quality: 'lite',
  upsert_thesis:      'lite',
  invalidate_thesis:  'lite',
  reactivate_thesis:  'lite',
  delete_thesis:      'lite',

  // ───── watchlist (4) — 全 lite ─────
  list_watchlist:   'lite',
  add_watchlist:    'lite',
  update_watchlist: 'lite',
  remove_watchlist: 'lite',

  // ───── alert (3) — 全 lite ─────
  set_price_alert: 'lite',
  list_alerts:     'lite',
  cancel_alert:    'lite',

  // ───── backfill (2) — admin ─────
  trigger_backfill:       'lite',
  trigger_batch_backfill: 'lite',

  // ───── forecast (4, 2026-06-30) — 近期分析波曝光 MCP ─────
  // 對齊分級矩陣（DECISION-feature-tiering-audit-2026-06-29）：預測/校準/盤前=standard、情境=premium。
  // 註：MCP 整體已被 mcp_external(premium) 守門 → MCP 客端皆 premium，此處 tier 主供顯示/契約一致性。
  get_price_forecast:       'standard',  // AI 預測機率錐
  get_forecast_calibration: 'standard',  // 前瞻校準帳本
  get_preopen_context:      'standard',  // 盤前脈絡（台股）
  run_scenario:             'premium',   // 情境實驗室（壓力傳播）
};

// 取得 tool 的 tier；找不到回 'lite'（保守）
function getTierFor(toolName) {
  return TIER_BY_TOOL[toolName] || 'lite';
}

// 給工具定義陣列 augment tier + category（不修改原 object，回新的）
function annotateWithTier(definitions) {
  return definitions.map(def => ({
    ...def,
    function: {
      ...def.function,
      tier: getTierFor(def.function.name),
    },
  }));
}

// 2026-05-16：完整 metadata（tier + category）— LLM tool selection 用
const { getCategoryFor } = require('./category-map');
function annotateWithMetadata(definitions) {
  return definitions.map(def => ({
    ...def,
    function: {
      ...def.function,
      tier: getTierFor(def.function.name),
      category: getCategoryFor(def.function.name),
    },
  }));
}

module.exports = { TIER_BY_TOOL, getTierFor, annotateWithTier, annotateWithMetadata };
