// Copyright (c) 2025-2026 Kevin Lin. All rights reserved.
// AI Tools — sentiment category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { callInternal, postInternal, putInternal, deleteInternal, resolveCode } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "analyze_sentiment",
      "description": "分析指定股票的新聞情緒（看漲/看跌/中性），回傳情緒分數與摘要",
      "parameters": {
        "type": "object",
        "properties": {
          "stockName": {
            "type": "string",
            "description": "股票名稱，例如「台積電」"
          },
          "stockCode": {
            "type": "string",
            "description": "股票代號，例如 2330"
          }
        },
        "required": [
          "stockName",
          "stockCode"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_market_sentiment",
      "description": "取得市場情緒分析（結合 FinBERT 新聞情緒、法人動向），回傳情緒指數（0-100）和各來源細項。比 analyze_sentiment 更精確",
      "parameters": {
        "type": "object",
        "properties": {
          "market": {
            "type": "string",
            "description": "市場: TW 或 US，預設 TW"
          }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_stock_sentiment_v2",
      "description": "取得個股情緒分析（NER 比對新聞 + FinBERT 情緒評分），回傳情緒時序和相關新聞",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "股票代號"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
          },
          "days": {
            "type": "number",
            "description": "查詢天數，預設 30"
          }
        },
        "required": [
          "stockId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_sentiment_forecasts",
      "description": "**未來走勢預測 / forecast / 未來價格推估** — 從輿情服務取得多模型對未來 1d / 5d / 10d / 1m / 3m horizon 的預測共識（含情緒驅動的方向 / 機率 / 置信度）。當使用者問「下週走勢」「未來表現」「會漲還是會跌」「下個月怎麼看」這類預測問題時優先用此工具。需後端 sentiment 服務啟用；未啟用時會回 enabled:false。",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "股票代號"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
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
      "name": "get_sentiment_entry_strategies",
      "description": "**進場時機建議 / entry timing / 何時買** — 從輿情服務取得情緒驅動的建議進場策略（含買點訊號 / 風險警示 / 建議持有時間）。當使用者問「現在該不該買」「進場時機」「什麼時候進場好」時用此工具。需後端 sentiment 服務啟用；未啟用時會回 enabled:false。",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "股票代號"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
          }
        },
        "required": [
          "code"
        ]
      }
    }
  }
];

const executors = {
  async analyze_sentiment(args) {
      // Fetch news and analyze with LLM (this is handled at a higher level)
      const news = await callInternal(`/api/news/${encodeURIComponent(args.stockName)}`);
      if (news.error || !Array.isArray(news) || news.length === 0) {
        return { error: '無法取得新聞資料進行情緒分析', news };
      }
      // Return news for LLM to analyze inline
      return {
        stockName: args.stockName,
        stockCode: args.stockCode,
        newsCount: news.length,
        headlines: news.slice(0, 10).map(n => ({
          title: n.title,
          source: n.source,
          pubDate: n.pubDate,
        })),
        instruction: '請根據以上新聞標題分析市場情緒，給出 -1.0 到 +1.0 的情緒分數，並說明判斷理由。',
      };
    },

  async get_market_sentiment(args) {
      const market = (args.market || 'TW').toUpperCase();
      const data = await callInternal(`/api/sentiment/dashboard/${market}/index`);
      if (data.error || !data.enabled) {
        return { error: '輿情系統未啟用或離線', hint: '可在設定中啟用「市場分析系統」對接' };
      }
      if (data.data) return data.data;
      return data;
    },

  async get_stock_sentiment_v2(args) {
      const code = resolveCode(args);
      const market = (args.market || 'TW').toUpperCase();
      const days = args.days || 30;
      const data = await callInternal(`/api/sentiment/v2/stock/${market}/${code}?days=${days}`);
      if (data.error || data.enabled === false) {
        return { error: '輿情系統未啟用或離線', hint: '可在設定中啟用「市場分析系統」對接' };
      }
      return data;
    },

  async get_sentiment_forecasts(args) {
      const code = resolveCode(args);
      if (!code) return { error: 'code 必填' };
      const market = (args.market || 'TW').toUpperCase();
      const data = await callInternal(`/api/sentiment/forecasts/${market}/${code}`);
      if (data.error) return data;
      if (data.enabled === false) return { enabled: false, message: data.message || '輿情對接未啟用' };
      return { enabled: true, code, market, data: data.data };
    },

  async get_sentiment_entry_strategies(args) {
      const code = resolveCode(args);
      if (!code) return { error: 'code 必填' };
      const market = (args.market || 'TW').toUpperCase();
      const data = await callInternal(`/api/sentiment/entry/${market}/${code}`);
      if (data.error) return data;
      if (data.enabled === false) return { enabled: false, message: data.message || '輿情對接未啟用' };
      return { enabled: true, code, market, data: data.data };
    }
};

module.exports = { definitions, executors };
