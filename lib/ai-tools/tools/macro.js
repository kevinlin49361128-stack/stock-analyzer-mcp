// Copyright (c) 2025-2026 Kevin Lin. All rights reserved.
// AI Tools — macro category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { callInternal, postInternal, putInternal, deleteInternal, resolveCode } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "get_macro_snapshot",
      "description": "取得美國總體經濟快照（FRED 資料）：10 年期公債殖利率、Fed Funds、CPI YoY、失業率、美元指數、VIX。用於判讀總經環境、跨資產情境、Risk-on/off 切換",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_macro_inflation",
      "description": "取得美國通膨數據：CPI、核心 CPI、PCE、核心 PCE 的最新值、年增率與趨勢方向。通膨是判斷 Fed 政策走向與股市估值的關鍵指標。",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_macro_employment",
      "description": "取得美國就業市場數據：非農就業、失業率、勞動參與率及趨勢。就業數據是 Fed 雙重使命之一，直接影響升降息預期。",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_macro_series",
      "description": "取得 FRED（聯準會）特定總經時間序列的歷史數據，例如 10 年期公債殖利率（DGS10）、聯邦基金利率（FEDFUNDS）、M2 貨幣供給（M2SL）、CPI（CPIAUCSL）等。適合深入分析單一宏觀指標的歷史走勢。",
      "parameters": {
        "type": "object",
        "properties": {
          "seriesId": {
            "type": "string",
            "description": "FRED 序列代號，例如 DGS10（10年利率）、FEDFUNDS（基準利率）、CPIAUCSL（CPI）、M2SL（M2）、UNRATE（失業率）"
          }
        },
        "required": [
          "seriesId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_yield_curve",
      "description": "取得美國殖利率曲線狀態（DGS10、DGS2、T10Y2Y）並判讀是否倒掛。殖利率倒掛歷史上常為衰退前兆",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_fed_policy_stance",
      "description": "判讀 Fed 當前貨幣政策立場（緊縮/中性/寬鬆）與近 6 個月趨勢（升息/持平/降息），基於 FRED 的 DFF（聯邦基金有效利率）",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_financial_events",
      "description": "取得股票的財務事件（除息日、法說會、財報發布日等）",
      "parameters": {
        "type": "object",
        "properties": {
          "symbol": {
            "type": "string",
            "description": "股票代號（美股直接代號，台股加 .TW 後綴）"
          }
        },
        "required": [
          "symbol"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_earnings_calendar",
      "description": "取得財經事件行事曆：法說會、財報發佈、股利發放、除權息日等重大事件。適合回答「近期有哪些重要財報」「這週有什麼大事件」。",
      "parameters": {
        "type": "object",
        "properties": {
          "from": {
            "type": "string",
            "description": "起始日期 YYYY-MM-DD，預設今日"
          },
          "to": {
            "type": "string",
            "description": "結束日期 YYYY-MM-DD，預設 14 天後"
          },
          "markets": {
            "type": "string",
            "description": "市場篩選，TW 或 US 或空白（兩個）"
          },
          "importance": {
            "type": "number",
            "description": "重要性最低門檻（0=全部 / 1=中 / 2=高），預設 0"
          }
        }
      }
    }
  }
];

const executors = {
  async get_macro_snapshot() {
      try {
        const macro = require('../../macro-indicators');
        const snap = macro.getSnapshot();
        if (!snap.configured && !snap.rates?.dgs10) {
          return { error: 'FRED 未設定且本地無資料', configured: false };
        }
        return snap;
      } catch (e) {
        return { error: `總經快照失敗: ${e.message}` };
      }
    },

  async get_macro_inflation(args = {}) {
      return callInternal('/api/macro/inflation', 15000);
    },

  async get_macro_employment(args = {}) {
      return callInternal('/api/macro/employment', 15000);
    },

  async get_macro_series(args) {
      if (!args.seriesId) return { error: 'seriesId 必填，例如 DGS10、FEDFUNDS、CPIAUCSL' };
      const data = await callInternal(`/api/macro/series/${encodeURIComponent(args.seriesId)}`, 20000);
      if (data.error) return data;
      // 時間序列可能很長，只給最近 60 筆
      const series = Array.isArray(data) ? data : (data.observations || data.data || data);
      const recent = Array.isArray(series) ? series.slice(-60) : series;
      return { seriesId: args.seriesId, count: Array.isArray(series) ? series.length : 0, recent };
    },

  async get_yield_curve() {
      try {
        const macro = require('../../macro-indicators');
        const yc = macro.getYieldCurve();
        if (!yc) return { error: '本地尚無殖利率資料，請先同步 FRED' };
        return yc;
      } catch (e) {
        return { error: `殖利率曲線查詢失敗: ${e.message}` };
      }
    },

  async get_fed_policy_stance() {
      try {
        const macro = require('../../macro-indicators');
        const fed = macro.getFedPolicy();
        if (!fed) return { error: '本地尚無 Fed Funds 資料' };
        return fed;
      } catch (e) {
        return { error: `Fed 政策查詢失敗: ${e.message}` };
      }
    },

  async get_financial_events(args) {
      const data = await callInternal(`/api/events/${args.symbol}`);
      if (data.error) return data;
      return data;
    },

  async get_earnings_calendar(args = {}) {
      const today = new Date().toISOString().slice(0, 10);
      const defaultTo = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      const from = args.from || today;
      const to = args.to || defaultTo;
      const params = new URLSearchParams({ from, to });
      if (args.markets) params.set('markets', args.markets);
      if (args.importance) params.set('importance', String(args.importance));
      params.set('limit', '100');
      const data = await callInternal(`/api/calendar?${params.toString()}`);
      if (data.error) return data;
      return { from, to, count: Array.isArray(data) ? data.length : (data.count || 0), events: Array.isArray(data) ? data : (data.events || data) };
    }
};

module.exports = { definitions, executors };
