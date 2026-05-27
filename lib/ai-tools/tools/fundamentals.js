// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
// AI Tools — fundamentals category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { callInternal, postInternal, putInternal, deleteInternal, resolveCode } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "get_fundamentals_from_db",
      "description": "從本地資料庫取得台股基本面數據（月營收、季度EPS、估值指標），比即時 API 更穩定完整",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "台股代號，例如 2330"
          },
          "type": {
            "type": "string",
            "description": "資料類型: revenue(月營收)、eps(季度EPS)、valuation(估值)、all(全部)，預設 all"
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
      "name": "get_financial_statements",
      "description": "取得台股公司的基本面財務數據：月營收、每股盈餘(EPS)、本益比(PER)、殖利率、股價淨值比等",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "台股代號，例如 2330"
          },
          "type": {
            "type": "string",
            "description": "資料類型: revenue(月營收)、eps(每股盈餘)、valuation(估值指標)，預設 valuation"
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
      "name": "get_monthly_revenue",
      "description": "取得台股個股月營收資料，包含年增率（YoY）、月增率（MoM），分析營收成長趨勢",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "台股代號，例如 2330"
          },
          "months": {
            "type": "number",
            "description": "查詢月數，預設 12"
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
      "name": "get_dividend_info",
      "description": "取得股票的殖利率現況、歷史殖利率趨勢、近期除息事件，評估股息投資價值",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "台股代號，例如 2330"
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
      "name": "get_stock_eps",
      "description": "從本地資料庫取得個股近 N 季的 EPS（每股盈餘）與年增率（YoY）。適合分析獲利趨勢、判斷成長加速或衰退。",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "股票代號，例如 2330、AAPL"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
          },
          "limit": {
            "type": "number",
            "description": "筆數（1-20，預設 8 季）"
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
      "name": "calculate_dcf",
      "description": "DCF 估值計算器。依使用者輸入的 FCF、成長率、折現率、永續成長率計算企業合理價值與每股內在價值。若未提供參數，會從資料庫推估合理預設值（FCF 以年化 EPS×流通股數×0.8 作代理）。回傳企業價值、每股內在價值、對現價的安全邊際。",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "股票代號，例如 2330"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
          },
          "fcf": {
            "type": "number",
            "description": "當前年度 Free Cash Flow（元）；未提供則用 EPS×Shares×0.8 代理"
          },
          "growthRate": {
            "type": "number",
            "description": "短期年成長率 (小數，例如 0.08 表示 8%)；未提供則用營收 YoY 平均"
          },
          "years": {
            "type": "number",
            "description": "預測年數，預設 5"
          },
          "terminalGrowth": {
            "type": "number",
            "description": "永續成長率 (小數)，預設 0.025"
          },
          "discountRate": {
            "type": "number",
            "description": "折現率 WACC (小數)，預設 0.09"
          },
          "sharesOutstanding": {
            "type": "number",
            "description": "流通在外股數；未提供則用 market_cap/price 推算"
          },
          "netCash": {
            "type": "number",
            "description": "淨現金（現金−負債，元），預設 0"
          },
          "includeSensitivity": {
            "type": "boolean",
            "description": "是否回傳 5×5 敏感度表（折現率×永續成長率），預設 false"
          }
        },
        "required": [
          "stockId"
        ]
      }
    }
  }
];

const executors = {
  async get_fundamentals_from_db(args) {
      const code = resolveCode(args);
      const type = args.type || 'all';
      const result = { stockId: code };
      const types = type === 'all' ? ['revenue', 'eps', 'valuation'] : [type];
  
      for (const t of types) {
        const data = await callInternal(`/api/db/${t}/${code}`);
        if (!data.error && Array.isArray(data) && data.length > 0) {
          if (t === 'revenue') {
            result.revenue = data.slice(0, 6).map(r => ({
              month: r.year_month, revenue: r.revenue,
              yoy: r.yoy_growth != null ? r.yoy_growth.toFixed(1) + '%' : null,
              mom: r.mom_growth != null ? r.mom_growth.toFixed(1) + '%' : null,
            }));
          } else if (t === 'eps') {
            result.eps = data.slice(0, 4).map(e => ({
              period: e.year + 'Q' + e.quarter, eps: e.eps,
              cumulative: e.cumulative_eps,
            }));
          } else if (t === 'valuation') {
            const latest = data[0];
            result.valuation = {
              date: latest.trade_date,
              per: latest.per, pbr: latest.pbr,
              dividendYield: latest.dividend_yield,
              marketCap: latest.market_cap ? latest.market_cap + ' 億' : null,
            };
          }
        }
      }
  
      if (Object.keys(result).length <= 1) {
        result.message = '無本地基本面資料（可改用 get_financial_statements 從 TWSE 即時查詢）';
      }
      return result;
    },

  async get_financial_statements(args) {
      const code = resolveCode(args);
      const type = args.type || 'valuation';
      const data = await callInternal(`/api/fundamental/${code}?type=${type}`);
      if (data.error) return data;
      return data;
    },

  async get_monthly_revenue(args) {
      const months = Math.min(args.months || 12, 24);
      const data = await callInternal(`/api/fundamental/${args.code}?type=revenue`);
      if (data.error) return data;
      const revenues = Array.isArray(data.revenue) ? data.revenue : [];
      if (!revenues.length) return { error: '無月營收資料，請確認股票代號是否正確' };
  
      const recent = revenues.slice(-months);
      const latest = recent[recent.length - 1];
  
      // 連續年增率正成長月數
      let consecutiveYoy = 0;
      for (let i = recent.length - 1; i >= 0; i--) {
        if ((recent[i].yoyGrowth || 0) > 0) consecutiveYoy++;
        else break;
      }
  
      const validYoy = recent.filter(r => r.yoyGrowth != null);
      const avgYoy = validYoy.length ? parseFloat((validYoy.reduce((s, r) => s + r.yoyGrowth, 0) / validYoy.length).toFixed(1)) : null;
  
      return {
        code: args.code,
        latestMonth: latest.month,
        latestRevenue: latest.revenue,
        latestYoY: `${latest.yoyGrowth}%`,
        latestMoM: `${latest.momGrowth}%`,
        avgYoY: avgYoy != null ? `${avgYoy}%` : '無資料',
        trend: consecutiveYoy >= 3
          ? `連續 ${consecutiveYoy} 個月年增率正成長`
          : consecutiveYoy > 0
            ? `近 ${consecutiveYoy} 個月年增率為正`
            : '近期年增率轉負',
        history: recent.slice(-6).map(r => ({
          month: r.month,
          revenue: r.revenue,
          yoy: `${r.yoyGrowth}%`,
          mom: `${r.momGrowth}%`,
        })),
      };
    },

  async get_dividend_info(args) {
      const [fundRaw, eventsRaw] = await Promise.all([
        callInternal(`/api/fundamental/${args.code}?type=valuation`),
        callInternal(`/api/events/${args.code}.TW`),
      ]);
  
      const val = fundRaw.valuation || {};
      const valHistory = Array.isArray(fundRaw.valuationHistory) ? fundRaw.valuationHistory : [];
  
      // 殖利率近 10 期紀錄 (每筆代表不同交易日)
      const yieldHistory = valHistory
        .filter(r => r.dividendYield > 0)
        .map(r => ({ date: r.date, yield: `${parseFloat(r.dividendYield).toFixed(2)}%` }));
  
      const yields = valHistory.filter(r => r.dividendYield > 0).map(r => r.dividendYield);
      const avgYield = yields.length ? parseFloat((yields.reduce((s, v) => s + v, 0) / yields.length).toFixed(2)) : null;
      const maxYield = yields.length ? parseFloat(Math.max(...yields).toFixed(2)) : null;
      const minYield = yields.length ? parseFloat(Math.min(...yields).toFixed(2)) : null;
  
      // 近期除息事件
      const events = Array.isArray(eventsRaw) ? eventsRaw : (eventsRaw.events || []);
      const divEvents = events
        .filter(e => (e.type || e.eventType || '').toLowerCase().includes('div'))
        .slice(0, 5)
        .map(e => ({ date: e.date || e.exDate, amount: e.cashDividend || e.amount, type: e.type || e.eventType }));
  
      return {
        code: args.code,
        currentDividendYield: val.dividendYield ? `${parseFloat(val.dividendYield).toFixed(2)}%` : '無資料',
        avgYield10d: avgYield ? `${avgYield}%` : '無資料',
        yieldRange: maxYield ? `${minYield}% ~ ${maxYield}%` : '無資料',
        currentPE: val.per || null,
        currentPB: val.pbr || null,
        recentDividendEvents: divEvents.length ? divEvents : '近期查無除息事件',
        yieldHistory,
      };
    },

  async get_stock_eps(args) {
      const code = resolveCode(args);
      const market = (args.market || 'TW').toUpperCase();
      const limit = Math.min(20, Math.max(1, parseInt(args.limit) || 8));
      if (!code) return { error: 'code 必填' };
      const data = await callInternal(`/api/db/eps/${encodeURIComponent(code)}?limit=${limit}`);
      if (data.error) return data;
      return { code, market, count: data.count, eps: data.data };
    },

  async calculate_dcf(args) {
      try {
        const dcf = require('../../dcf');
        const database = require('../../database');
        const stockId = resolveCode(args);
        const market = (args.market || 'TW').toUpperCase();
  
        // 推估預設值
        const defaults = dcf.estimateInputs(stockId, market);
        const merged = {
          fcf:               args.fcf               ?? defaults.fcf,
          growthRate:        args.growthRate        ?? defaults.growthRate,
          years:             args.years             ?? defaults.years,
          terminalGrowth:    args.terminalGrowth    ?? defaults.terminalGrowth,
          discountRate:      args.discountRate      ?? defaults.discountRate,
          sharesOutstanding: args.sharesOutstanding ?? defaults.sharesOutstanding,
          netCash:           args.netCash           ?? defaults.netCash,
        };
  
        if (!merged.fcf || !merged.sharesOutstanding) {
          return {
            error: '缺少必要參數',
            missing: [!merged.fcf && 'fcf', !merged.sharesOutstanding && 'sharesOutstanding'].filter(Boolean),
            defaults,
            note: '請使用者提供 FCF 與流通股數，或確認該股票 EPS/market_cap 是否已同步',
          };
        }
  
        const result = dcf.calculateDCF(merged);
        const prices = database.getDailyPrices(stockId, 1, market) || [];
        const currentPrice = prices[0]?.close_price ? Number(prices[0].close_price) : null;
        const marginOfSafety = (currentPrice && result.perShare)
          ? (result.perShare - currentPrice) / currentPrice
          : null;
  
        let sensitivity = null;
        if (args.includeSensitivity) {
          const rRange = [-0.02, -0.01, 0, 0.01, 0.02].map(d => merged.discountRate + d);
          const gRange = [-0.01, -0.005, 0, 0.005, 0.01].map(d => Math.max(0, merged.terminalGrowth + d));
          sensitivity = dcf.sensitivityTable(merged, rRange, gRange);
        }
  
        return {
          stockId, market,
          inputs: merged,
          dataQuality: defaults.dataQuality,
          currentPrice,
          perShareIntrinsicValue: result.perShare,
          marginOfSafety,
          enterpriseValue: result.enterpriseValue,
          equityValue: result.equityValue,
          terminalValue: result.terminalValue,
          yearly: result.yearly,
          sensitivity,
        };
      } catch (e) {
        return { error: `DCF 計算失敗: ${e.message}` };
      }
    }
};

module.exports = { definitions, executors };
