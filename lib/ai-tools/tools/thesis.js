// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
// AI Tools — thesis category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { callInternal, postInternal, putInternal, deleteInternal, resolveCode } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "list_theses",
      "description": "列出所有股票投資論點（thesis）。可選擇只看仍有效的、或只看快到 next_review_date 的。",
      "parameters": {
        "type": "object",
        "properties": {
          "activeOnly": {
            "type": "boolean",
            "description": "只回未失效的論點，預設 false"
          },
          "dueForReview": {
            "type": "boolean",
            "description": "只回已到下次檢查日期的論點，預設 false"
          }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_thesis",
      "description": "查詢單檔股票的投資論點（hypothesis、key_levels、risk_conditions、watch_points、tags、next_review_date）。",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "股票代號，例如 2330 或 AAPL"
          },
          "market": {
            "type": "string",
            "description": "TW 或 US"
          }
        },
        "required": [
          "stockId",
          "market"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "upsert_thesis",
      "description": "新增或更新單檔股票的投資論點。同一 (stockId, market) 只能有一筆，重覆呼叫會覆寫。",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "股票代號"
          },
          "market": {
            "type": "string",
            "description": "TW 或 US"
          },
          "hypothesis": {
            "type": "string",
            "description": "主要投資假設文字"
          },
          "key_levels": {
            "type": "object",
            "description": "關鍵價位 {entry, target, stopLoss}"
          },
          "risk_conditions": {
            "type": "string",
            "description": "失效條件文字"
          },
          "watch_points": {
            "type": "string",
            "description": "需要追蹤的觀察點"
          },
          "next_review_date": {
            "type": "string",
            "description": "下次檢查日期 YYYY-MM-DD"
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "分類標籤陣列"
          }
        },
        "required": [
          "stockId",
          "market"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "invalidate_thesis",
      "description": "把某檔股票的投資論點標記為失效（保留紀錄，可日後 reactivate）。",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "股票代號"
          },
          "market": {
            "type": "string",
            "description": "TW 或 US"
          },
          "reason": {
            "type": "string",
            "description": "失效理由（選填）"
          }
        },
        "required": [
          "stockId",
          "market"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "reactivate_thesis",
      "description": "重啟之前標記為失效的投資論點。",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "股票代號"
          },
          "market": {
            "type": "string",
            "description": "TW 或 US"
          }
        },
        "required": [
          "stockId",
          "market"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "delete_thesis",
      "description": "永久刪除某檔股票的投資論點（無法復原；非必要請改用 invalidate_thesis）。",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "股票代號"
          },
          "market": {
            "type": "string",
            "description": "TW 或 US"
          }
        },
        "required": [
          "stockId",
          "market"
        ]
      }
    }
  }
];

const executors = {
  async list_theses(args = {}) {
      const params = new URLSearchParams();
      if (args.activeOnly) params.set('activeOnly', '1');
      if (args.dueForReview) params.set('dueForReview', '1');
      const q = params.toString();
      return await callInternal(`/api/thesis${q ? '?' + q : ''}`);
    },

  async get_thesis(args) {
      const { stockId, market } = args;
      if (!stockId || !market) return { error: 'stockId 與 market 必填' };
      return await callInternal(`/api/thesis/${encodeURIComponent(market)}/${encodeURIComponent(stockId)}`);
    },

  async upsert_thesis(args) {
      const { stockId, market } = args;
      if (!stockId || !market) return { error: 'stockId 與 market 必填' };
      const body = {
        hypothesis:       args.hypothesis,
        key_levels:       args.key_levels,
        risk_conditions:  args.risk_conditions,
        watch_points:     args.watch_points,
        next_review_date: args.next_review_date,
        tags:             args.tags,
      };
      const result = await putInternal(`/api/thesis/${encodeURIComponent(market)}/${encodeURIComponent(stockId)}`, body);
      // 整合缺口 #3：論點有 key_levels（停損 / 目標）→ 附建議警示，讓 caller 提議
      // 用 set_price_alert 建（不自動建 — 建 alert 仍走確認流程）。
      if (result && !result.error && args.key_levels) {
        try {
          const { suggestedAlertsFromThesis } = require('../../thesis-alert-link');
          const suggested = suggestedAlertsFromThesis({ key_levels: args.key_levels });
          if (suggested.length) {
            result.suggestedAlerts = suggested.map(a => ({ ...a, code: stockId, market }));
            result.suggestedAlertsHint = '可用 set_price_alert 在這些價位建提醒，論點失效時會通知。';
          }
        } catch { /* 附加資訊失敗不影響主結果 */ }
      }
      return result;
    },

  async invalidate_thesis(args) {
      const { stockId, market, reason } = args;
      if (!stockId || !market) return { error: 'stockId 與 market 必填' };
      return await postInternal(
        `/api/thesis/${encodeURIComponent(market)}/${encodeURIComponent(stockId)}/invalidate`,
        { reason: reason || null }
      );
    },

  async reactivate_thesis(args) {
      const { stockId, market } = args;
      if (!stockId || !market) return { error: 'stockId 與 market 必填' };
      return await postInternal(
        `/api/thesis/${encodeURIComponent(market)}/${encodeURIComponent(stockId)}/reactivate`,
        {}
      );
    },

  async delete_thesis(args) {
      const { stockId, market } = args;
      if (!stockId || !market) return { error: 'stockId 與 market 必填' };
      return await deleteInternal(`/api/thesis/${encodeURIComponent(market)}/${encodeURIComponent(stockId)}`);
    }
};

module.exports = { definitions, executors };
