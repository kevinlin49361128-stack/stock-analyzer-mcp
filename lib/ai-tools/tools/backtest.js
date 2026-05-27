// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
// AI Tools — backtest category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { BASE, callInternal, postInternal, putInternal, deleteInternal, resolveCode } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "backtest_strategy",
      "description": "回測交易策略 — 用歷史數據驗證策略績效。支援策略：rsi_oversold(RSI超賣)、ma_crossover(均線交叉)、breakout(突破)、mean_reversion(均值回歸)",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "股票代號，例如 2330"
          },
          "strategy": {
            "type": "string",
            "description": "策略名稱: rsi_oversold, ma_crossover, breakout, mean_reversion"
          },
          "days": {
            "type": "number",
            "description": "回測天數，預設 252（一年）"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
          }
        },
        "required": [
          "stockId",
          "strategy"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "backtest_grid_search",
      "description": "對單一策略做參數網格搜尋 — 在指定參數範圍內跑完所有組合，找出夏普比率最高的參數配置。適合「我想知道 RSI 策略用哪組參數最穩」這類問題。",
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
          "strategy": {
            "type": "string",
            "description": "策略名稱：rsi_oversold / ma_crossover / breakout / mean_reversion"
          },
          "days": {
            "type": "number",
            "description": "回測天數（預設 252）"
          },
          "paramGrid": {
            "type": "object",
            "description": "參數網格，key 為參數名、value 為候選值陣列。例如 {\"period\":[10,14,20],\"threshold\":[25,30,35]}"
          }
        },
        "required": [
          "stockId",
          "strategy",
          "paramGrid"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "backtest_multi_strategy",
      "description": "對同一標的並排比較多個策略的表現（最多 6 個），一次看清哪個策略在這檔最適合。",
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
          "strategies": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "策略陣列，例如 [\"rsi_oversold\",\"ma_crossover\",\"breakout\"]"
          },
          "days": {
            "type": "number",
            "description": "回測天數（預設 252）"
          }
        },
        "required": [
          "stockId",
          "strategies"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "monte_carlo_factor_mining",
      "description": "蒙地卡羅隨機選股因子挖掘（B2 Factor Mining）— 翻轉「哪個組合最好」（brute force selection bias 必死）為「好組合的共同特徵是什麼」。跑 N 個隨機組合 → 對每個組合算因子暴露（動能 / 波動度 / 規模 / 產業集中度...）→ 對 (factor, sharpe) 做迴歸找出顯著因子。輸出：因子排序 + Pearson r + R² + scatter raw data。屬研究工具，輸出應做新策略假設源、不該直接交易。",
      "parameters": {
        "type": "object",
        "properties": {
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
          },
          "startDate": {
            "type": "string",
            "description": "回測起日 YYYY-MM-DD"
          },
          "endDate": {
            "type": "string",
            "description": "回測迄日 YYYY-MM-DD"
          },
          "nPicks": {
            "type": "number",
            "description": "隨機抽幾檔（2-50，預設 10）"
          },
          "nSimulations": {
            "type": "number",
            "description": "次數（100-5000，預設 1000）"
          }
        },
        "required": [
          "startDate",
          "endDate"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "monte_carlo_random_portfolio",
      "description": "蒙地卡羅隨機選股 benchmark — 從指定 universe 隨機抽 N 檔等權重持有 K 次，得到 random benchmark 分布；如帶入用戶策略指標，回傳該策略落點百分位 + p-value。回答「我的策略真有 alpha 還是運氣好」。低頻交易者特別有效（單條 path 不穩 → MC 把 single-path 變 distribution）。",
      "parameters": {
        "type": "object",
        "properties": {
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
          },
          "startDate": {
            "type": "string",
            "description": "回測起日 YYYY-MM-DD"
          },
          "endDate": {
            "type": "string",
            "description": "回測迄日 YYYY-MM-DD"
          },
          "nPicks": {
            "type": "number",
            "description": "隨機抽幾檔（2-50，預設 10）"
          },
          "nSimulations": {
            "type": "number",
            "description": "次數（100-10000，預設 1000；建議 ≥ 1000）"
          },
          "pool": {
            "type": "string",
            "description": "universe pool：all（預設）/ top50_100（v2）"
          },
          "strategyTotalReturn": {
            "type": "number",
            "description": "用戶策略總報酬率 %（用來算百分位；可選）"
          },
          "strategySharpe": {
            "type": "number",
            "description": "用戶策略 Sharpe（可選）"
          },
          "strategyMaxDD": {
            "type": "number",
            "description": "用戶策略最大回撤 %（正值；可選）"
          }
        },
        "required": [
          "startDate",
          "endDate"
        ]
      }
    }
  }
];

const executors = {
  async backtest_strategy(args) {
      const resp = await fetch(`${BASE}/api/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockId: args.stockId,
          strategy: args.strategy,
          days: args.days || 252,
          market: args.market || 'TW',
          params: args.params || {},
        }),
        timeout: 30000,
      });
      if (!resp.ok) return { error: `API returned ${resp.status}` };
      const data = await resp.json();
      // Summarize for LLM context
      return {
        stockId: data.stockId,
        strategy: data.strategyLabel,
        period: data.period,
        totalTrades: data.totalTrades,
        winRate: data.winRate + '%',
        avgReturn: data.avgReturn + '%',
        totalReturn: data.totalReturn + '%',
        buyHoldReturn: data.buyHoldReturn + '%',
        maxDrawdown: data.maxDrawdown + '%',
        sharpeRatio: data.sharpeRatio,
        profitFactor: data.profitFactor,
        avgHoldingDays: data.avgHoldingDays,
        bestTrade: data.bestTrade,
        worstTrade: data.worstTrade,
        recentTrades: (data.trades || []).slice(-5),
      };
    },

  async backtest_grid_search(args) {
      if (!args?.stockId || !args?.strategy || !args?.paramGrid) {
        return { error: 'stockId / strategy / paramGrid 必填' };
      }
      const body = {
        stockId:   args.stockId,
        market:    (args.market || 'TW').toUpperCase(),
        strategy:  args.strategy,
        days:      args.days || 252,
        paramGrid: args.paramGrid,
      };
      const data = await postInternal('/api/backtest/grid-search', body, 60000);
      if (data.error) return data;
      // 精簡：只回傳前 10 名 + best
      const results = Array.isArray(data.results) ? data.results : [];
      const ranked = results
        .filter(r => !r.error && r.sharpeRatio != null)
        .sort((a, b) => (b.sharpeRatio || -999) - (a.sharpeRatio || -999));
      return {
        stockId: body.stockId,
        strategy: body.strategy,
        combinations: data.combinations || results.length,
        best: data.best || ranked[0] || null,
        top10: ranked.slice(0, 10).map(r => ({
          params: r.params,
          totalReturn: r.totalReturn,
          sharpeRatio: r.sharpeRatio,
          maxDrawdown: r.maxDrawdown,
          winRate: r.winRate,
          trades: r.trades,
        })),
      };
    },

  async backtest_multi_strategy(args) {
      if (!args?.stockId || !Array.isArray(args.strategies) || args.strategies.length === 0) {
        return { error: 'stockId 與 strategies[] 必填' };
      }
      const body = {
        stockId:    args.stockId,
        market:     (args.market || 'TW').toUpperCase(),
        strategies: args.strategies.slice(0, 6),
        days:       args.days || 252,
      };
      const data = await postInternal('/api/backtest/multi', body, 60000);
      if (data.error) return data;
      // 精簡
      const results = Array.isArray(data.results) ? data.results : [];
      return {
        stockId: body.stockId,
        days: body.days,
        strategies: results.map(r => ({
          strategy: r.strategy,
          label: r.label,
          ok: r.ok,
          error: r.error,
          totalReturn:  r.ok ? r.result?.totalReturn    : null,
          annualReturn: r.ok ? r.result?.annualReturn   : null,
          sharpeRatio:  r.ok ? r.result?.sharpeRatio    : null,
          maxDrawdown:  r.ok ? r.result?.maxDrawdown    : null,
          winRate:      r.ok ? r.result?.winRate        : null,
          tradeCount:   r.ok ? (Array.isArray(r.result?.trades) ? r.result.trades.length : r.result?.tradeCount ?? null) : null,
        })),
      };
    },

  async monte_carlo_factor_mining(args) {
      if (!args?.startDate || !args?.endDate) {
        return { error: 'startDate / endDate 必填（YYYY-MM-DD）' };
      }
      const body = {
        market:       (args.market || 'TW').toUpperCase(),
        startDate:    args.startDate,
        endDate:      args.endDate,
        nPicks:       args.nPicks || 10,
        nSimulations: args.nSimulations || 1000,
      };
      const data = await postInternal('/api/backtest/random-portfolio-factor-mining', body, 90000);
      if (data.error) return data;
      // 精簡：scatters 過大，只保留 ranked + regressions
      return {
        market: data.market,
        period: data.period,
        universe: data.universe,
        nSimulations: data.nSimulations,
        successfulSims: data.successfulSims,
        elapsedMs: data.elapsedMs,
        ranked: data.ranked,
        regressions: data.regressions,
        topFactors: data.topFactors,
        factorLabels: data.factorLabels,
      };
    },

  async monte_carlo_random_portfolio(args) {
      if (!args?.startDate || !args?.endDate) {
        return { error: 'startDate / endDate 必填（YYYY-MM-DD）' };
      }
      const body = {
        market:        (args.market || 'TW').toUpperCase(),
        startDate:     args.startDate,
        endDate:       args.endDate,
        nPicks:        args.nPicks || 10,
        nSimulations:  args.nSimulations || 1000,
        pool:          args.pool || 'all',
      };
      if (args.strategyTotalReturn != null || args.strategySharpe != null || args.strategyMaxDD != null) {
        body.strategyMetrics = {
          totalReturn: args.strategyTotalReturn,
          sharpe:      args.strategySharpe,
          maxDD:       args.strategyMaxDD,
        };
      }
      const data = await postInternal('/api/backtest/random-portfolio-mc', body, 60000);
      if (data.error) return data;
      // 精簡：raw 陣列丟掉，只回 distribution stats + 用戶策略落點
      return {
        market: data.market,
        period: data.period,
        universe: data.universe,
        nSimulations: data.nSimulations,
        successfulSims: data.successfulSims,
        elapsedMs: data.elapsedMs,
        distribution: data.distribution,
        strategy: data.strategy,
        interpretation: data.interpretation,
      };
    }
};

module.exports = { definitions, executors };
