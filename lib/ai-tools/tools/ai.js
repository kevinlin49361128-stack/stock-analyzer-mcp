// Copyright (c) 2025-2026 Kevin Lin. All rights reserved.
// AI Tools — ai category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { callInternal, postInternal, putInternal, deleteInternal, resolveCode, registry: EXECUTORS } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "get_full_stock_analysis",
      "description": "一次取得個股完整分析資料：即時報價＋技術指標（RSI/MACD/KD/布林）＋三大法人＋月營收＋新聞情緒。適合「幫我完整分析 XXXX」類型的問題。",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "台股代號，例如 2330"
          },
          "market": {
            "type": "string",
            "description": "TW 或 US，預設 TW"
          }
        },
        "required": [
          "code"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "screen_stocks",
      "description": "自然語言選股 — 根據條件篩選符合條件的台股或美股。可篩選：外資買超、股價站上均線、漲跌幅、成交量、市值、本益比等",
      "parameters": {
        "type": "object",
        "properties": {
          "conditions": {
            "type": "string",
            "description": "自然語言篩選條件，例如「外資連續買超3日且股價站上月線」或具體條件如 JSON"
          },
          "market": {
            "type": "string",
            "description": "市場: tw 或 us，預設 tw"
          },
          "topN": {
            "type": "number",
            "description": "回傳前 N 檔，預設 10"
          }
        },
        "required": [
          "conditions"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "create_analysis_workflow",
      "description": "一鍵執行完整個股研究工作流：並行取得即時報價、技術指標、籌碼面、基本面、交易價位、法人動態，一次拿到所有投資決策所需資料。比逐一呼叫各工具更高效，適合「幫我完整分析 2330」此類請求。",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "股票代號，例如 2330"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
          },
          "steps": {
            "type": "array",
            "description": "指定步驟（選填）：price, technical, chip, fundamentals, levels, institutional, news",
            "items": {
              "type": "string",
              "enum": [
                "price",
                "technical",
                "chip",
                "fundamentals",
                "levels",
                "institutional",
                "news"
              ]
            }
          }
        },
        "required": [
          "code"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "save_analysis_note",
      "description": "儲存一筆分析備忘（文字筆記），之後可以透過查詢讀取。",
      "parameters": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string",
            "description": "標題"
          },
          "content": {
            "type": "string",
            "description": "備忘內容"
          },
          "stockId": {
            "type": "string",
            "description": "相關股票代號（選填）"
          }
        },
        "required": [
          "title",
          "content"
        ]
      }
    }
  }
];

const executors = {
  async get_full_stock_analysis(args) {
      const code = resolveCode(args);
      const market = (args.market || 'TW').toUpperCase();
      // 並行取得所有面向
      const [quote, indicators, institutional, revenue, sentiment] = await Promise.allSettled([
        EXECUTORS.get_stock_price({ code }),
        EXECUTORS.get_technical_indicators({ code, market }),
        EXECUTORS.get_institutional_flow({}),
        EXECUTORS.get_monthly_revenue({ code }),
        EXECUTORS.get_stock_sentiment_v2({ code }),
      ]);
      return {
        quote:        quote.status === 'fulfilled' ? quote.value : { error: quote.reason?.message },
        indicators:   indicators.status === 'fulfilled' ? indicators.value : { error: indicators.reason?.message },
        institutional: institutional.status === 'fulfilled' ? institutional.value : { error: institutional.reason?.message },
        revenue:      revenue.status === 'fulfilled' ? revenue.value : { error: revenue.reason?.message },
        sentiment:    sentiment.status === 'fulfilled' ? sentiment.value : { error: sentiment.reason?.message },
      };
    },

  async screen_stocks(args) {
      const data = await callInternal(`/api/screen?conditions=${encodeURIComponent(args.conditions || '')}&market=${args.market || 'tw'}&topN=${args.topN || 10}`, 45000);
      if (data.error) return data;
      const results = data.results || data;
      if (Array.isArray(results)) {
        return { market: (args.market || 'tw').toUpperCase(), count: results.length, results };
      }
      return data;
    },

  async create_analysis_workflow(args) {
      const code = resolveCode(args);
      const market = (args.market || 'TW').toUpperCase();
      const steps = args.steps || ['price', 'technical', 'chip', 'fundamentals', 'levels', 'institutional'];
  
      const tasks = {};
      if (steps.includes('price'))        tasks.price        = EXECUTORS.get_stock_price({ code });
      if (steps.includes('technical'))    tasks.technical    = EXECUTORS.get_technical_indicators({ code, market });
      if (steps.includes('chip'))         tasks.chip         = EXECUTORS.get_chip_flow_overview({ code });
      if (steps.includes('fundamentals')) tasks.fundamentals = EXECUTORS.get_financial_statements({ code });
      if (steps.includes('levels'))       tasks.levels       = EXECUTORS.get_trading_levels({ code, market });
      if (steps.includes('institutional')) tasks.institutional = EXECUTORS.get_institutional_flow({});
      if (steps.includes('news'))         tasks.news         = EXECUTORS.get_news({ query: code, market });
  
      const settled = await Promise.allSettled(Object.values(tasks));
      const keys = Object.keys(tasks);
      const result = { code, market, generatedAt: new Date().toISOString() };
      keys.forEach((k, i) => {
        result[k] = settled[i].status === 'fulfilled' ? settled[i].value : { error: settled[i].reason?.message };
      });
      return result;
    },

  async save_analysis_note(args) {
      // 筆記不需要確認，直接寫入
      try {
        const database = require('../../database');
        const key = `ai_note_${Date.now()}`;
        const value = JSON.stringify({ title: args.title, content: args.content, stockId: args.stockId, createdAt: new Date().toISOString() });
        database.setSystemSetting(key, value);
        return { ok: true, title: args.title, message: '備忘已儲存' };
      } catch (e) {
        return { error: `儲存失敗: ${e.message}` };
      }
    }
};

module.exports = { definitions, executors };
