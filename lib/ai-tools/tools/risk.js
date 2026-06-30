// Copyright (c) 2025-2026 Kevin Lin. All rights reserved.
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
  },
  {
    "type": "function",
    "function": {
      "name": "get_portfolio_stress",
      "description": "投組情境壓力測試（一階線性近似，Beta 放大）：預設情境 台股-5%/美股科技-10%/半導體-8%/美元+3% 對目前持倉的估計衝擊（TWD 與 %）+ 各情境主要受傷部位。描述性風險脈絡，非預測、非建議。",
      "parameters": {
        "type": "object",
        "properties": {
          "fxRate": {
            "type": "number",
            "description": "USD/TWD 匯率覆寫；不給則用 live 匯率（DB 快取 fallback）"
          }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_risk_contribution",
      "description": "投組邊際/成分 VaR 風險貢獻（95% 1日參數法，Euler 分解）：每檔持股的風險占比 vs 市值占比、marginal VaR、component VaR（TWD），找出「哪檔最拖累投組」與隱性風險（風險占比 > 市值占比）。描述性風險歸因，非建議。",
      "parameters": {
        "type": "object",
        "properties": {
          "days": {
            "type": "number",
            "description": "歷史視窗交易日數（60-2520），預設 252"
          }
        },
        "required": []
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
            // Wave 1 fix（audit P0#8）：帶 trade_date，worker 端按日期交集對齊（原 index 對齊會錯位）
            priceHistory[p.stock_id] = prices.map(d => ({ d: d.trade_date, c: d.close_price }));
          }
        }
  
        if (Object.keys(priceHistory).length === 0) {
          return { error: '歷史價格資料不足' };
        }
  
        // 取得現價（使用最新 DB 資料）
        // Wave 1 fix（audit P0#3 同族）：美股現價原以 USD 直接進權重/總值（偏 ~32 倍）→ 折 TWD
        const fxRate = await require('../../exchange-rate').resolveFxRateOrDefault(database.getDB());
        const positionsWithPrice = positions
          .filter(p => priceHistory[p.stock_id])
          .map(p => ({
            stockId: p.stock_id,
            market: p.market,
            shares: p.total_shares,
            currentPrice: (priceHistory[p.stock_id].slice(-1)[0]?.c || p.avg_cost)
              * (String(p.market).toUpperCase() === 'US' ? fxRate : 1),
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
      // Wave 1 fix（2026-06-10 audit P0#2）：route 回傳是 {available, ...result} 頂層展開，
      // 原本讀 data.result 永遠 undefined → AI/MCP 只拿到 {"available":true}。改取頂層摘要。
      if (!data.available) return { available: false, message: data.message || null };
      return {
        available: true,
        riskLevel: data.riskLevel ?? null,           // {level,name,score,maxScore,triggers}
        sentiment: data.sentiment ?? null,
        liquidity: data.liquidity ?? null,
        stressTests: Array.isArray(data.stressTests) ? data.stressTests.slice(0, 5) : null,
        macroContext: data.macroContext ?? null,
        timestamp: data.timestamp ?? null,
        ageMs: data.ageMs ?? null,
      };
    },

  // W32（2026-06-10 audit Tier-1 #4）：0.47.21 建好的壓測引擎讓 AI Hub / multi-agent
  // risk_manager / MCP 叫得到（risk_manager 原本被 prompt 要求「自己腦補」壓力情境）。
  async get_portfolio_stress(args = {}) {
      try {
        const fx = Number(args.fxRate) > 0
          ? Number(args.fxRate)
          : await require('../../exchange-rate').resolveFxRateOrDefault(require('../../database').getDB());
        return require('../../portfolio-stress').runStressTest({ fxRate: fx });
      } catch (e) {
        return { error: `壓力測試失敗: ${e.message}` };
      }
    },

  // I4（2026-06-10 viz×integration 決策）：W32 的 MVaR 端點只接了前端圖表 ——
  // 工具化讓 AI Hub / MCP 能回答「哪檔最拖累投組」。計算本體共用 lib/risk-contribution。
  async get_risk_contribution(args = {}) {
      try {
        const r = await require('../../risk-contribution').computeRiskContribution({ days: args.days });
        if (r.summary?.error) return { error: r.summary.error, summary: r.summary };
        return {
          items: (r.items || []).slice(0, 15),   // top 15 已涵蓋決策需求，控 context
          summary: r.summary,
          note: '風險占比 > 市值占比 = 隱性風險高於體感；componentVaRTwd 加總 = 投組 95% 1日 VaR',
        };
      } catch (e) {
        return { error: `風險貢獻計算失敗: ${e.message}` };
      }
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

        // 維度防呆（同 risk-contribution 2026-06-26 修）：估 N×N 共變異需觀測數充分於資產數，
        // 否則 rank-deficient → 共變異/夏普/權重靜默退化。T 由「最短序列」決定（含薄歷史股就崩）。
        const minObs = Math.max(60, N * 2);                  // 滿秩+穩定門檻，隨資產數縮放
        if (T - 1 <= N) {                                    // 有效報酬數 ≤ 資產數 → 共變異必退化
          return {
            error: `觀測數不足以估 ${N}×${N} 共變異數：有效日報酬僅 ${T - 1} 筆 ≤ 資產數 ${N}（矩陣退化、結果不可信）。請縮短清單或改選歷史較長的標的。`,
            assets: N, observations: T - 1, recommendedMinObs: minObs,
            thinHistoryCodes: validCodes.filter(c => returns[c].length < minObs),
          };
        }
        const lowConfidence = T < minObs;
        const thinHistoryCodes = validCodes.filter(c => returns[c].length < minObs);

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
          dataConfidence: {
            observations: T,
            recommendedMinObs: minObs,
            lowConfidence,                                   // true = 觀測數 < max(60, 資產數×2)
            ...(lowConfidence ? { thinHistoryCodes } : {}),
          },
          note: lowConfidence
            ? `⚠️ 觀測數僅 ${T} 筆 < 建議 ${minObs}（${N} 檔需 obs 充分於資產數）→ 共變異/夏普估計不穩、配置僅供參考。${thinHistoryCodes.length ? '歷史偏短：' + thinHistoryCodes.join('/') + '。' : ''}基於歷史價格，不代表未來表現。`
            : '基於歷史價格，不代表未來表現。各股最低配置 2% 以確保分散效果。',
        };
      } catch (e) {
        return { error: `最佳化失敗: ${e.message}` };
      }
    }
};

module.exports = { definitions, executors };
