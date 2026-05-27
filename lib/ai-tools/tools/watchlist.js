// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
// AI Tools — watchlist category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { callInternal, postInternal, putInternal, deleteInternal, resolveCode } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "list_watchlist",
      "description": "列出關注清單（與實際持倉 portfolio 分開，只是觀察追蹤）。",
      "parameters": {
        "type": "object",
        "properties": {
          "market": {
            "type": "string",
            "description": "TW 或 US，留空回所有市場"
          }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "add_watchlist",
      "description": "把股票加入關注清單。",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "股票代號"
          },
          "market": {
            "type": "string",
            "description": "TW 或 US，預設 TW"
          },
          "display_name": {
            "type": "string",
            "description": "顯示名稱（選填）"
          },
          "note": {
            "type": "string",
            "description": "備註（選填）"
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "標籤陣列"
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
      "name": "update_watchlist",
      "description": "修改關注清單某筆項目的 note / tags / display_name（要 id）。",
      "parameters": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number",
            "description": "關注清單項目 id"
          },
          "display_name": {
            "type": "string"
          },
          "note": {
            "type": "string"
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "id"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "remove_watchlist",
      "description": "從關注清單移除一筆股票（提供 id 或 stockId+market 組合）。",
      "parameters": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number",
            "description": "項目 id（與 stockId+market 二選一）"
          },
          "stockId": {
            "type": "string"
          },
          "market": {
            "type": "string"
          }
        },
        "required": []
      }
    }
  }
];

const executors = {
  async list_watchlist(args = {}) {
      const q = args.market ? `?market=${encodeURIComponent(args.market)}` : '';
      return await callInternal(`/api/watchlist${q}`);
    },

  async add_watchlist(args) {
      if (!args.stockId) return { error: 'stockId 必填' };
      return await postInternal('/api/watchlist', {
        stock_id:     args.stockId,
        market:       args.market || 'TW',
        display_name: args.display_name,
        note:         args.note,
        tags:         args.tags,
      });
    },

  async update_watchlist(args) {
      if (!args.id) return { error: 'id 必填' };
      const { id, ...body } = args;
      return await putInternal(`/api/watchlist/${id}`, body);
    },

  async remove_watchlist(args) {
      if (args.id) return await deleteInternal(`/api/watchlist/${args.id}`);
      if (args.stockId && args.market) {
        return await deleteInternal(
          `/api/watchlist?stock_id=${encodeURIComponent(args.stockId)}&market=${encodeURIComponent(args.market)}`
        );
      }
      return { error: '需提供 id 或 stockId+market 組合' };
    }
};

module.exports = { definitions, executors };
