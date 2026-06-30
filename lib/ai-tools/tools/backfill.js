// Copyright (c) 2025-2026 Kevin Lin. All rights reserved.
// AI Tools — backfill category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { callInternal, postInternal, putInternal, deleteInternal, resolveCode } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "trigger_backfill",
      "description": "對指定股票立即啟動歷史日線補齊（不等排程，直接執行）。適合當圖表顯示歷史資料不足時主動幫用戶補料。補齊作業透過 SSE 回報進度，通常數秒至數十秒完成。",
      "parameters": {
        "type": "object",
        "properties": {
          "symbol": {
            "type": "string",
            "description": "股票代號，例如 AAPL、2330、ASML"
          },
          "market": {
            "type": "string",
            "description": "市場：TW 或 US"
          },
          "years": {
            "type": "number",
            "description": "補齊年份，預設 5"
          }
        },
        "required": [
          "symbol",
          "market"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "trigger_batch_backfill",
      "description": "對指定的一批股票（symbols 陣列）立即啟動歷史日線批次補齊。適合當用戶的投資組合或多檔股票都缺少足夠歷史資料時一次性補全。每個市場同時只能有一個補齊作業。",
      "parameters": {
        "type": "object",
        "properties": {
          "market": {
            "type": "string",
            "description": "市場：TW 或 US"
          },
          "symbols": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "股票代號陣列，例如 [\"2330\",\"0050\",\"00646\"]"
          },
          "years": {
            "type": "number",
            "description": "補齊年份，預設 5"
          },
          "skipExisting": {
            "type": "boolean",
            "description": "跳過已有足夠資料的股票，預設 false（全部重新補）"
          }
        },
        "required": [
          "market",
          "symbols"
        ]
      }
    }
  }
];

const executors = {
  async trigger_backfill(args) {
      const { symbol, market = 'TW', years = 5 } = args;
      if (!symbol) return { error: 'symbol 必填' };
      const data = await postInternal('/api/backfill/single', {
        symbol: String(symbol).trim().toUpperCase(),
        market: String(market).toUpperCase(),
        years: parseInt(years) || 5,
      });
      if (data.error) return data;
      return { ok: true, symbol, market, years, message: `${symbol} 歷史資料補齊已啟動（${years}年），資料載入後需重新查詢價格歷史。` };
    },

  async trigger_batch_backfill(args) {
      const { market = 'TW', symbols, years = 5, skipExisting = false } = args;
      if (!Array.isArray(symbols) || symbols.length === 0) {
        return { error: 'symbols 必須為非空陣列' };
      }
      const data = await postInternal('/api/backfill/symbols', {
        market: String(market).toUpperCase(),
        symbols,
        years: parseInt(years) || 5,
        skipExisting: !!skipExisting,
      }, 10000);
      if (data.error) return data;
      return {
        ok: true,
        market,
        total: data.total,
        symbols: data.symbols,
        message: `已啟動 ${data.total} 支 ${market} 股票的歷史資料批次補齊（${years} 年），補齊完成後需重新查詢價格歷史。`,
      };
    }
};

module.exports = { definitions, executors };
