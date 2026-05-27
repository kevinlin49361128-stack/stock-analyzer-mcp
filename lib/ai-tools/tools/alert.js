// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
// AI Tools — alert category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { callInternal, postInternal, putInternal, deleteInternal, resolveCode } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "set_price_alert",
      "description": "設定股價提醒，執行前會請使用者確認。條件：above（突破）或 below（跌破）。",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "股票代號，例如 2330"
          },
          "market": {
            "type": "string",
            "description": "TW 或 US，預設 TW"
          },
          "name": {
            "type": "string",
            "description": "股票名稱（選填）"
          },
          "condition": {
            "type": "string",
            "description": "above 或 below"
          },
          "price": {
            "type": "number",
            "description": "觸發價格"
          }
        },
        "required": [
          "code",
          "condition",
          "price"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_alerts",
      "description": "列出所有股價/條件提醒（包含已觸發、未觸發）。",
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
      "name": "cancel_alert",
      "description": "取消一筆股價/條件提醒（用 id）。",
      "parameters": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number",
            "description": "alert id"
          }
        },
        "required": [
          "id"
        ]
      }
    }
  }
];

const executors = {
  async set_price_alert(args) {
      return {
        __pending_action: true,
        tool: 'set_price_alert',
        params: args,
        description: `設定價格提醒：${args.code} 股價${args.condition === 'above' ? '突破' : '跌破'} ${args.price}`,
      };
    },

  async list_alerts() {
      return await callInternal('/api/alerts');
    },

  async cancel_alert(args) {
      if (!args.id) return { error: 'id 必填' };
      return await deleteInternal(`/api/alerts/${args.id}`);
    }
};

module.exports = { definitions, executors };
