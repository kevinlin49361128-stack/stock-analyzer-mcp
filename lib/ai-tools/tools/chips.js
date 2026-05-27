// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
// AI Tools — chips category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { callInternal, postInternal, putInternal, deleteInternal, resolveCode } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "get_institutional_flow",
      "description": "取得今日台股三大法人整體概況：外資、投信、自營商合計買賣超金額，以及各產業淨流向排名。適合快速掌握大盤法人動態。",
      "parameters": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string",
            "description": "查詢日期 YYYYMMDD 格式，預設最近交易日"
          }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_fund_flow_sankey",
      "description": "取得三大法人資金按產業細分的詳細流向，可指定外資/投信/自營商，顯示各投資人對每個產業的具體買賣超金額。適合深入分析特定投資人的產業佈局。",
      "parameters": {
        "type": "object",
        "properties": {
          "investor": {
            "type": "string",
            "description": "法人類型: all, foreign, trust, dealer，預設 all"
          },
          "topN": {
            "type": "number",
            "description": "顯示前 N 大產業，預設 10"
          }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_chip_flow_overview",
      "description": "取得個股完整籌碼面概覽：融資融券餘額/使用率、鉅額交易、內部人持股異動（資料來源：Solo Market Database）",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "台股代號，例如 2330"
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
      "name": "get_margin_ranking",
      "description": "取得全市場融資使用率排行 — 高融資使用率是潛在風險訊號",
      "parameters": {
        "type": "object",
        "properties": {
          "limit": {
            "type": "number",
            "description": "回傳前 N 檔，預設 20"
          }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_abnormal_blocks",
      "description": "取得近期異常鉅額交易清單 — 大戶或法人的大額買賣訊號",
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
      "name": "get_insider_alerts",
      "description": "取得內部人（董監事/大股東）近期大量賣出警示",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  }
];

const executors = {
  async get_institutional_flow(args) {
      // Use sankey API to get aggregated data
      const data = await callInternal('/api/sankey/fund-flow?mode=sector&investor=all&topN=15');
      if (data.error) return data;
      return {
        date: data.date,
        summary: data.summary,
        topSectors: (data.nodes || [])
          .filter(n => n.type === 'sector')
          .slice(0, 10)
          .map(n => {
            const inflows = (data.links || []).filter(l => l.target === n.id);
            const net = inflows.reduce((s, l) => s + (l.direction === 'buy' ? l.value : -l.value), 0);
            return { sector: n.name, netFlow: net, direction: net >= 0 ? '買超' : '賣超' };
          }),
      };
    },

  async get_fund_flow_sankey(args) {
      const investor = args.investor || 'all';
      const topN = args.topN || 10;
      const data = await callInternal(`/api/sankey/fund-flow?mode=sector&investor=${investor}&topN=${topN}`);
      if (data.error) return data;
      return {
        date: data.date,
        summary: data.summary,
        sectors: (data.nodes || [])
          .filter(n => n.type === 'sector')
          .map(n => {
            const relatedLinks = (data.links || []).filter(l => l.target === n.id);
            return {
              name: n.name,
              flows: relatedLinks.map(l => ({
                from: (data.nodes.find(nn => nn.id === l.source) || {}).name,
                value: l.value,
                direction: l.direction,
              })),
            };
          }),
      };
    },

  async get_chip_flow_overview(args) {
      const code = resolveCode(args);
      const days = args.days || 30;
      const data = await callInternal(`/api/chipflow/overview/${code}?days=${days}`);
      if (data.error) return data;
      // Summarize for LLM
      const result = { stockId: code };
      if (data.margin && data.margin.length > 0) {
        const latest = data.margin[0];
        result.margin = {
          date: latest.trade_date,
          marginBalance: latest.margin_balance,
          marginUtilization: latest.margin_utilization + '%',
          shortBalance: latest.short_balance,
          riskLevel: latest.margin_utilization > 25 ? '⚠ 高融資' : latest.margin_utilization > 15 ? '偏高' : '正常',
        };
      }
      if (data.blockTrades && data.blockTrades.length > 0) {
        result.blockTrades = data.blockTrades.slice(0, 5).map(b => ({
          date: b.trade_date, amount: b.total_amount, isAbnormal: b.is_abnormal,
        }));
      }
      if (data.insider && data.insider.length > 0) {
        result.insider = data.insider.slice(0, 5).map(i => ({
          date: i.filing_date, name: i.insider_name, role: i.insider_role,
          action: i.action, shares: i.shares_changed,
        }));
      }
      if (!result.margin && !result.blockTrades && !result.insider) {
        result.message = '無籌碼面資料（Solo Market Database 可能尚未同步此股）';
      }
      return result;
    },

  async get_margin_ranking(args) {
      const limit = args.limit || 20;
      const data = await callInternal(`/api/chipflow/margin-ranking?limit=${limit}`);
      if (data.error) return data;
      if (Array.isArray(data)) {
        return {
          count: data.length,
          description: '融資使用率排行（高使用率代表散戶融資買入多，可能是反向指標）',
          ranking: data.slice(0, 15).map(r => ({
            stockId: r.stock_id, name: r.name,
            utilization: r.margin_utilization + '%',
            marginBalance: r.margin_balance,
            shortBalance: r.short_balance,
          })),
        };
      }
      return data;
    },

  async get_abnormal_blocks(args) {
      const data = await callInternal('/api/chipflow/abnormal-blocks');
      if (data.error) return data;
      if (Array.isArray(data)) {
        return {
          count: data.length,
          description: '異常鉅額交易（成交量顯著偏離均值）',
          trades: data.slice(0, 10).map(b => ({
            stockId: b.stock_id, name: b.name, date: b.trade_date,
            amount: b.total_amount,
          })),
        };
      }
      return data;
    },

  async get_insider_alerts(args) {
      const data = await callInternal('/api/chipflow/insider-alerts');
      if (data.error) return data;
      if (Array.isArray(data)) {
        return {
          count: data.length,
          description: '內部人（董監事/大股東）近期大量賣出警示',
          alerts: data.slice(0, 10).map(i => ({
            stockId: i.stock_id, name: i.name, filingDate: i.filing_date,
            insiderName: i.insider_name, role: i.insider_role,
            action: i.action, sharesChanged: i.shares_changed,
          })),
        };
      }
      return data;
    }
};

module.exports = { definitions, executors };
