// ============================================
// Copyright (c) 2025-2026 Stock Analyzer. Released under MIT — see LICENSE.
// AI Tools — Category metadata
//
// 用途：給 LLM tool selection 一個結構化分類，提高選工具準確度
// LLM 看完整 80+ tools 一次 description 容易選錯；先看 category 過濾再 selection 更準
//
// Categories（對應 lib/ai-tools.js modules）：
//   market       即時報價 / 歷史 / 熱力圖 / 排行
//   chips        三大法人 / 籌碼 / 內部人
//   fundamentals 財報 / 月營收 / 股利
//   technical    指標 / K 線型態 / 相關性
//   macro        總經 / FED / 殖利率
//   sentiment    新聞情緒 / 情報指標
//   portfolio    投資組合分析 / 持倉 / 集中度
//   backtest     回測 / 蒙地卡羅 / 因子探索
//   risk         系統性風險 / VaR
//   ai           AI 分析任務 / 工作流
//   thesis       投資論述
//   watchlist    自選股管理
//   alert        價格提醒
//   backfill     資料補抓（admin）
// ============================================

'use strict';

const CATEGORY_BY_TOOL = {
  // ── market (13) ──
  get_stock_price:        'market',
  get_us_stock_quote:     'market',
  get_price_history:      'market',
  get_market_heatmap:     'market',
  get_market_overview:    'market',
  get_sector_ranking:     'market',
  get_news:               'market',
  get_exchange_rate:      'market',
  get_seasonality:        'market',
  compare_stocks:         'market',
  get_stock_radar:        'market',
  get_etf_holdings:       'market',
  get_trading_day_status: 'market',  // 2026-05-16 新增

  // ── chips (6) ──
  get_institutional_flow: 'chips',
  get_fund_flow_sankey:   'chips',
  get_chip_flow_overview: 'chips',
  get_margin_ranking:     'chips',
  get_abnormal_blocks:    'chips',
  get_insider_alerts:     'chips',

  // ── fundamentals (6) ──
  get_fundamentals_from_db: 'fundamentals',
  get_financial_statements: 'fundamentals',
  get_monthly_revenue:      'fundamentals',
  get_dividend_info:        'fundamentals',
  get_stock_eps:            'fundamentals',
  calculate_dcf:            'fundamentals',

  // ── technical (5) ──
  get_technical_indicators: 'technical',
  detect_kline_patterns:    'technical',
  get_trading_levels:       'technical',
  get_stock_correlation:    'technical',
  get_stock_beta:           'technical',

  // ── macro (8) ──
  get_macro_snapshot:      'macro',
  get_macro_inflation:     'macro',
  get_macro_employment:    'macro',
  get_macro_series:        'macro',
  get_fed_policy_stance:   'macro',
  get_yield_curve:         'macro',
  get_financial_events:    'macro',
  get_earnings_calendar:   'macro',

  // ── sentiment (5) ──
  analyze_sentiment:                'sentiment',
  get_market_sentiment:             'sentiment',
  get_stock_sentiment_v2:           'sentiment',
  get_sentiment_forecasts:          'sentiment',
  get_sentiment_entry_strategies:   'sentiment',

  // ── portfolio (10) ──
  get_portfolio:                'portfolio',
  add_trade:                    'portfolio',
  update_trade:                 'portfolio',
  delete_trade:                 'portfolio',
  get_trade_journal:            'portfolio',
  get_pnl_realized:             'portfolio',
  analyze_trade_performance:    'portfolio',
  get_portfolio_concentration:  'portfolio',
  get_portfolio_performance:    'portfolio',
  get_portfolio_score:          'portfolio',
  get_portfolio_signals:        'portfolio',

  // ── backtest (5) ──
  backtest_strategy:           'backtest',
  backtest_multi_strategy:     'backtest',
  backtest_grid_search:        'backtest',
  monte_carlo_random_portfolio: 'backtest',
  monte_carlo_factor_mining:    'backtest',

  // ── risk (3) ──
  get_systemic_risk:        'risk',
  calculate_portfolio_var:  'risk',
  optimize_portfolio:       'risk',

  // ── screener (1) ──
  screen_stocks:            'market',  // 選股放 market

  // ── ai (3) ──
  create_analysis_workflow: 'ai',
  save_analysis_note:       'ai',
  get_full_stock_analysis:  'ai',

  // ── research (4, 2026-05-18 Sprint B+C) — LLM-backed 與 deterministic 聚合器 ──
  research_stock_deep_dive:       'ai',  // Sprint B, LLM
  portfolio_daily_briefing:       'ai',  // Sprint B, LLM
  compare_investment_candidates:  'ai',  // Sprint C, deterministic
  post_trade_review:              'ai',  // Sprint C, deterministic

  // ── thesis (5) ──
  list_theses:           'thesis',
  get_thesis:            'thesis',
  upsert_thesis:         'thesis',
  invalidate_thesis:     'thesis',
  reactivate_thesis:     'thesis',
  delete_thesis:         'thesis',

  // ── watchlist (4) ──
  list_watchlist:        'watchlist',
  add_watchlist:         'watchlist',
  update_watchlist:      'watchlist',
  remove_watchlist:      'watchlist',

  // ── alert (3) ──
  set_price_alert: 'alert',
  list_alerts:     'alert',
  cancel_alert:    'alert',

  // ── backfill (2) ──
  trigger_backfill:       'backfill',
  trigger_batch_backfill: 'backfill',
};

// Category 描述（給 LLM 看的「這個 category 是做什麼的」）
const CATEGORY_DESCRIPTIONS = {
  market:       '即時報價、歷史K線、熱力圖、產業排行、ETF、總覽',
  chips:        '三大法人買賣、資金流向、籌碼集中度、內部人交易、異常成交',
  fundamentals: '財報、月營收、股利、EPS、DCF 估值',
  technical:    '技術指標、K 線型態、進出場價位、相關性、Beta',
  macro:        '總體經濟、FED、殖利率、財經事件曆、財報日曆',
  sentiment:    '新聞輿情、市場情緒、個股情緒分析、情緒進場策略',
  portfolio:    '投資組合管理、交易紀錄、損益分析、集中度、信號評估',
  backtest:     '策略回測、多策略比較、網格搜尋、蒙地卡羅、因子探索',
  risk:         '系統性風險、VaR、投資組合最佳化',
  ai:           'AI 分析工作流、分析筆記、整合分析',
  thesis:       '投資論述（hypothesis / key levels / 失效條件）',
  watchlist:    '自選股清單管理',
  alert:        '價格提醒',
  backfill:     '資料補抓（管理用）',
};

function getCategoryFor(toolName) {
  return CATEGORY_BY_TOOL[toolName] || 'other';
}

function listCategories() {
  return Object.keys(CATEGORY_DESCRIPTIONS);
}

function getCategoryDescription(cat) {
  return CATEGORY_DESCRIPTIONS[cat] || null;
}

module.exports = {
  CATEGORY_BY_TOOL,
  CATEGORY_DESCRIPTIONS,
  getCategoryFor,
  listCategories,
  getCategoryDescription,
};
