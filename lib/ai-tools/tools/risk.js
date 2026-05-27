// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
// AI Tools — risk category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { callInternal, postInternal, putInternal, deleteInternal, resolveCode } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "calculate_portfolio_var",
      "description": "計算投資組合的風險值 (Value at Risk)，包含歷史 VaR、參數 VaR、條件 VaR (Expected Shortfall)，以及各持股的風險貢獻度",
      "parameters": {
        "type": "object",
        "properties": {
          "confidence": {
            "type": "number",
            "description": "信心水準，0.90 或 0.95 或 0.99，預設 0.95"
          },
          "horizon": {
            "type": "number",
            "description": "持有期間（天），預設 1"
          }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_systemic_risk",
      "description": "取得當前市場的系統性風險評估：VIX 水準、信用利差、流動性指標等，綜合判定市場風險環境。適合回答「現在市場整體風險高嗎」「適合進場嗎」。",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "optimize_portfolio",
      "description": "投資組合最佳化 — Markowitz 最大夏普比率法。輸入多檔股票，根據歷史日報酬率計算最優權重配置，輸出各股建議比例、預期年報酬、年化波動度、夏普比率。",
      "parameters": {
        "type": "object",
        "properties": {
          "codes": {
            "type": "string",
            "description": "股票代號（逗號分隔，2-10 檔），例如 2330,2454,2303,2382"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
          },
          "riskFreeRate": {
            "type": "number",
            "description": "無風險利率（年化小數），預設 0.02（2%）"
          }
        },
        "required": [
          "codes"
        ]
      }
    }
  }
];

const executors = {
  async calculate_portfolio_var(args) {
      try {
        const database = require('../../database');
        const { getComputePool } = require('../../worker-pool');
  
        const positions = database.getPositions();
        if (!positions || positions.length === 0) {
          return { error: '無持倉資料' };
        }
  
        // 收集各持股的歷史價格
        const priceHistory = {};
        for (const p of positions) {
          const prices = database.getDailyPrices(p.stock_id, 252, p.market);
          if (prices.length >= 20) {
            priceHistory[p.stock_id] = prices.map(d => d.close_price);
          }
        }
  
        if (Object.keys(priceHistory).length === 0) {
          return { error: '歷史價格資料不足' };
        }
  
        // 取得現價（使用最新 DB 資料）
        const positionsWithPrice = positions
          .filter(p => priceHistory[p.stock_id])
          .map(p => ({
            stockId: p.stock_id,
            market: p.market,
            shares: p.total_shares,
            currentPrice: priceHistory[p.stock_id].slice(-1)[0] || p.avg_cost,
            avgCost: p.avg_cost,
          }));
  
        // 使用 Worker Thread 計算 VaR（CPU 密集）
        const pool = getComputePool();
        const result = await pool.run({
          type: 'portfolio_var',
          payload: {
            positions: positionsWithPrice,
            priceHistory,
            confidence: args.confidence || 0.95,
            horizon: args.horizon || 1,
          },
        }, 30000);
  
        return result;
      } catch (e) {
        return { error: `VaR 計算失敗: ${e.message}` };
      }
    },

  async get_systemic_risk(args = {}) {
      const data = await callInternal('/api/systemic-risk', 15000);
      if (data.error) return data;
      // result 可能很大，回傳頂層摘要即可
      return { available: data.available, result: data.result };
    },

  async optimize_portfolio(args) {
      try {
        const codes = (args.codes || '').split(',').map(c => c.trim()).filter(Boolean);
        if (codes.length < 2) return { error: '至少需要 2 檔股票（逗號分隔）' };
  
        const market = (args.market || 'TW').toUpperCase();
        const targetReturn = args.targetReturn || null;
        const riskFree = args.riskFreeRate || 0.02;
  
        // 取得各股歷史價格
        const priceArrays = {};
        await Promise.all(codes.map(async (code) => {
          const resp = await callInternal(`/api/db/prices/${code}?days=252&market=${market}&autofill=1`);
          const rows = Array.isArray(resp) ? resp : (resp.data || []);
          if (rows.length >= 20) priceArrays[code] = rows.map(r => Number(r.close_price));
        }));
  
        const validCodes = Object.keys(priceArrays);
        if (validCodes.length < 2) return { error: '有效歷史資料不足（至少需要 2 檔各 20 天）', available: validCodes };
  
        // 計算日報酬率
        const returns = {};
        for (const code of validCodes) {
          const prices = priceArrays[code];
          returns[code] = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
        }
  
        const N = validCodes.length;
        const T = Math.min(...validCodes.map(c => returns[c].length));
  
        // 均值向量
        const mu = validCodes.map(c => {
          const r = returns[c].slice(-T);
          return r.reduce((s, v) => s + v, 0) / T * 252; // 年化
        });
  
        // 共變異數矩陣（年化）
        const cov = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => {
          const ri = returns[validCodes[i]].slice(-T);
          const rj = returns[validCodes[j]].slice(-T);
          const mi = mu[i] / 252, mj = mu[j] / 252;
          const c = ri.reduce((s, v, k) => s + (v - mi) * (rj[k] - mj), 0) / (T - 1);
          return c * 252; // 年化
        }));
  
        // 最大夏普比率組合（簡化梯度法）
        let w = validCodes.map(() => 1 / N);
        for (let iter = 0; iter < 500; iter++) {
          const portRet = w.reduce((s, wi, i) => s + wi * mu[i], 0);
          const portVar = w.reduce((s, wi, i) => s + w.reduce((ss, wj, j) => ss + wi * wj * cov[i][j], 0), 0);
          const portStd = Math.sqrt(portVar);
          const sharpe = portStd > 0 ? (portRet - riskFree) / portStd : 0;
  
          // 數值梯度
          const grad = w.map((_, i) => {
            const e = 1e-5;
            const wUp = [...w]; wUp[i] += e;
            const s = wUp.reduce((a, b) => a + b, 0);
            const wNorm = wUp.map(v => v / s);
            const pR = wNorm.reduce((a, wi, k) => a + wi * mu[k], 0);
            const pV = wNorm.reduce((a, wi, k) => a + wNorm.reduce((b, wj, l) => b + wi * wj * cov[k][l], 0), 0);
            return pV > 0 ? (pR - riskFree) / Math.sqrt(pV) - sharpe : 0;
          });
  
          const lr = 0.01;
          w = w.map((wi, i) => Math.max(0.02, wi + lr * grad[i]));
          const sum = w.reduce((a, b) => a + b, 0);
          w = w.map(v => v / sum);
        }
  
        const portRet = w.reduce((s, wi, i) => s + wi * mu[i], 0);
        const portVar = w.reduce((s, wi, i) => s + w.reduce((ss, wj, j) => ss + wi * wj * cov[i][j], 0), 0);
        const portStd = Math.sqrt(portVar);
  
        return {
          method: 'Max Sharpe Ratio (Markowitz)',
          market,
          allocation: validCodes.map((code, i) => ({
            code,
            weight: parseFloat((w[i] * 100).toFixed(1)) + '%',
            weightNum: parseFloat((w[i] * 100).toFixed(1)),
            expectedAnnualReturn: parseFloat((mu[i] * 100).toFixed(2)) + '%',
          })).sort((a, b) => b.weightNum - a.weightNum),
          portfolioMetrics: {
            expectedAnnualReturn: parseFloat((portRet * 100).toFixed(2)) + '%',
            annualVolatility: parseFloat((portStd * 100).toFixed(2)) + '%',
            sharpeRatio: parseFloat(((portRet - riskFree) / portStd).toFixed(3)),
            riskFreeRate: (riskFree * 100).toFixed(1) + '%',
          },
          note: '基於歷史價格，不代表未來表現。各股最低配置 2% 以確保分散效果。',
        };
      } catch (e) {
        return { error: `最佳化失敗: ${e.message}` };
      }
    }
};

module.exports = { definitions, executors };
