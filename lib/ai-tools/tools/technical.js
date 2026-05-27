// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
// AI Tools — technical category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { callInternal, postInternal, putInternal, deleteInternal, resolveCode } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "get_technical_indicators",
      "description": "計算股票目前的技術指標：RSI(14)、MACD(12,26,9)、KD(9,3,3)、布林通道(20,2)、量比，判斷超買超賣狀態與趨勢方向",
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
      "name": "detect_kline_patterns",
      "description": "偵測股票 K 線型態（錘子、吞噬、晨星、暮星、三白兵、三黑鴉等 13 種常見反轉/持續型態）。回傳最近出現的型態清單及各自方向與信心值。",
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
          "days": {
            "type": "number",
            "description": "檢視天數，預設 60"
          },
          "minConfidence": {
            "type": "number",
            "description": "信心值下限 0-1，預設 0.6"
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
      "name": "get_trading_levels",
      "description": "計算股票的左側與右側交易價位。左側（逆勢/抄底）包含均線支撐、Fibonacci回撤等；右側（順勢/追漲）包含突破壓力、均線站上確認等",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "股票代號，例如 2330"
          },
          "days": {
            "type": "number",
            "description": "計算用的歷史天數，預設 60"
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
      "name": "get_stock_correlation",
      "description": "計算多檔股票之間的相關性矩陣（Pearson 相關係數）",
      "parameters": {
        "type": "object",
        "properties": {
          "stocks": {
            "type": "string",
            "description": "股票代號（逗號分隔），例如 2330,2454,2317"
          },
          "days": {
            "type": "number",
            "description": "計算天數，預設 60"
          }
        },
        "required": [
          "stocks"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_stock_beta",
      "description": "計算個股的 Beta 係數（相對大盤的系統性風險）、與大盤的相關係數、年化波動度。用於風險調整評價與資產配置。Beta > 1 表示比大盤更敏感。",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "股票代號，例如 2330、NVDA"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
          },
          "windowDays": {
            "type": "number",
            "description": "計算窗口天數，預設 252（1 年）"
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
  async get_technical_indicators(args) {
      const code = resolveCode(args);
      const market = args.market || 'TW';
      const resp = await callInternal(`/api/db/prices/${code}?days=120&market=${market}&autofill=1`);
      if (resp.error) return resp;
      // /api/db/prices returns {stockId, market, count, data:[...], sync}
      const data = Array.isArray(resp) ? resp : (resp.data || []);
      if (data.length < 30) return { error: '歷史資料不足，無法計算技術指標（至少需要 30 天）' };
  
      const closes = data.map(d => d.close_price);
      const highs  = data.map(d => d.high_price);
      const lows   = data.map(d => d.low_price);
      const vols   = data.map(d => d.volume);
      const n = closes.length;
  
      // EMA helper (初始值用第一個資料點)
      const calcEma = (arr, period) => {
        const k = 2 / (period + 1);
        let val = arr[0];
        for (let i = 1; i < arr.length; i++) val = arr[i] * k + val * (1 - k);
        return val;
      };
  
      // RSI(14) — Wilder smoothing
      const rsiPeriod = 14;
      let avgGain = 0, avgLoss = 0;
      for (let i = 1; i <= rsiPeriod; i++) {
        const d = closes[i] - closes[i - 1];
        if (d > 0) avgGain += d; else avgLoss -= d;
      }
      avgGain /= rsiPeriod;
      avgLoss /= rsiPeriod;
      for (let i = rsiPeriod + 1; i < n; i++) {
        const d = closes[i] - closes[i - 1];
        avgGain = (avgGain * (rsiPeriod - 1) + Math.max(d, 0)) / rsiPeriod;
        avgLoss = (avgLoss * (rsiPeriod - 1) + Math.max(-d, 0)) / rsiPeriod;
      }
      const rsi = avgLoss === 0 ? 100 : parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));
  
      // MACD(12,26,9)
      const macdLine = calcEma(closes, 12) - calcEma(closes, 26);
      const macdHistory = [];
      for (let i = 25; i < n; i++) macdHistory.push(calcEma(closes.slice(0, i + 1), 12) - calcEma(closes.slice(0, i + 1), 26));
      const signalLine = calcEma(macdHistory.slice(-20), 9);
      const histogram = macdLine - signalLine;
  
      // KD(9) — 台灣加權平滑法 (2/3 + 1/3)
      let kVal = 50, dVal = 50;
      for (let i = 8; i < n; i++) {
        const sliceH = highs.slice(i - 8, i + 1);
        const sliceL = lows.slice(i - 8, i + 1);
        const hh = Math.max(...sliceH), ll = Math.min(...sliceL);
        const rsv = hh === ll ? 50 : (closes[i] - ll) / (hh - ll) * 100;
        kVal = kVal * 2 / 3 + rsv / 3;
        dVal = dVal * 2 / 3 + kVal / 3;
      }
      const k = parseFloat(kVal.toFixed(1)), d = parseFloat(dVal.toFixed(1));
  
      // Bollinger Bands(20, 2)
      const bbSlice = closes.slice(-20);
      const sma20 = bbSlice.reduce((s, v) => s + v, 0) / 20;
      const stdDev = Math.sqrt(bbSlice.reduce((s, v) => s + (v - sma20) ** 2, 0) / 20);
      const bbUpper = parseFloat((sma20 + 2 * stdDev).toFixed(2));
      const bbLower = parseFloat((sma20 - 2 * stdDev).toFixed(2));
      const bbWidth = parseFloat(((bbUpper - bbLower) / sma20 * 100).toFixed(1));
      const pctB = bbUpper === bbLower ? 50 : parseFloat(((closes[n - 1] - bbLower) / (bbUpper - bbLower) * 100).toFixed(1));
  
      // 量比 (今日量 / 近 5 日均量)
      const vol5avg = vols.slice(-6, -1).reduce((s, v) => s + v, 0) / 5;
      const volRatio = parseFloat((vols[n - 1] / (vol5avg || 1)).toFixed(2));
  
      return {
        stockId: args.stockId,
        date: data[n - 1].trade_date,
        price: closes[n - 1],
        rsi: {
          value: rsi,
          signal: rsi >= 70 ? '超買' : rsi <= 30 ? '超賣' : '中性',
          note: 'RSI(14)，>70 超買，<30 超賣',
        },
        macd: {
          macdLine: parseFloat(macdLine.toFixed(3)),
          signalLine: parseFloat(signalLine.toFixed(3)),
          histogram: parseFloat(histogram.toFixed(3)),
          signal: histogram > 0 && macdLine > 0 ? '多頭' : histogram < 0 && macdLine < 0 ? '空頭' : histogram > 0 ? '趨勢轉強' : '趨勢轉弱',
          note: 'MACD(12,26,9)',
        },
        kd: {
          k, d,
          signal: k >= 80 ? '超買' : k <= 20 ? '超賣' : k > d ? '多頭排列' : '空頭排列',
          note: 'KD(9,3,3)，K>80 超買，K<20 超賣',
        },
        bollinger: {
          upper: bbUpper,
          middle: parseFloat(sma20.toFixed(2)),
          lower: bbLower,
          width: bbWidth,
          pctB,
          signal: pctB >= 100 ? '觸及上軌（強勢）' : pctB <= 0 ? '觸及下軌（弱勢）' : pctB >= 70 ? '偏強' : pctB <= 30 ? '偏弱' : '中性',
          note: 'Bollinger(20,2)，%B=現價在通道中的位置',
        },
        volume: {
          today: vols[n - 1],
          avg5d: Math.round(vol5avg),
          ratio: volRatio,
          signal: volRatio >= 2 ? '爆量' : volRatio >= 1.5 ? '量增' : volRatio <= 0.5 ? '量縮' : '正常',
        },
      };
    },

  async detect_kline_patterns(args) {
      try {
        const database = require('../../database');
        const { detectPatterns, PATTERN_LABELS } = require('../../patterns');
        const stockId = resolveCode(args);
        const market = (args.market || 'TW').toUpperCase();
        const days = args.days || 60;
        const minConfidence = args.minConfidence ?? 0.6;
  
        const rows = database.getDailyPrices(stockId, days, market);
        if (!rows || rows.length < 3) return { error: '歷史資料不足（需至少 3 日）' };
  
        const bars = rows.map(r => ({
          date: r.trade_date,
          open: Number(r.open_price),
          high: Number(r.high_price),
          low: Number(r.low_price),
          close: Number(r.close_price),
          volume: Number(r.volume || 0),
        })).sort((a, b) => a.date.localeCompare(b.date));
  
        const hits = detectPatterns(bars, { minConfidence });
        const enriched = hits.map(h => ({
          date: h.date,
          patterns: h.patterns.map(p => ({ ...p, label: PATTERN_LABELS[p.name] || p.name })),
        }));
        return {
          stockId, market, days,
          totalDetected: enriched.length,
          patterns: enriched,
        };
      } catch (e) {
        return { error: `型態偵測失敗: ${e.message}` };
      }
    },

  async get_trading_levels(args) {
      const code = resolveCode(args);
      const days = args.days || 60;
      const market = args.market || 'TW';
      const resp = await callInternal(`/api/db/prices/${code}?days=${days}&market=${market}&autofill=1`);
      if (resp.error) return { error: '歷史資料不足，無法計算交易價位', detail: resp.error };
      const data = Array.isArray(resp) ? resp : (resp.data || []);
      if (data.length < 20) {
        return { error: '歷史資料不足，無法計算交易價位（至少需要 20 天）', available: data.length };
      }
  
      // Sort ascending
      const sorted = data.sort((a, b) => a.trade_date.localeCompare(b.trade_date));
      const closes = sorted.map(d => d.close_price);
      const highs = sorted.map(d => d.high_price);
      const lows = sorted.map(d => d.low_price);
      const volumes = sorted.map(d => d.volume);
      const currentPrice = closes[closes.length - 1];
  
      // --- Moving Averages ---
      const calcMA = (arr, period) => {
        if (arr.length < period) return null;
        const slice = arr.slice(-period);
        return +(slice.reduce((s, v) => s + v, 0) / period).toFixed(2);
      };
      const ma5 = calcMA(closes, 5);
      const ma10 = calcMA(closes, 10);
      const ma20 = calcMA(closes, 20);
      const ma60 = calcMA(closes, 60);
  
      // --- Recent swing high/low (20-day) ---
      const recent20 = sorted.slice(-20);
      const high20 = Math.max(...recent20.map(d => d.high_price));
      const low20 = Math.min(...recent20.map(d => d.low_price));
  
      // --- Fibonacci retracement from 60-day swing ---
      const high60 = Math.max(...highs);
      const low60 = Math.min(...lows);
      const range60 = high60 - low60;
      const fib = {
        'fib_0.0_高點': +high60.toFixed(2),
        'fib_0.236': +(high60 - range60 * 0.236).toFixed(2),
        'fib_0.382': +(high60 - range60 * 0.382).toFixed(2),
        'fib_0.5': +(high60 - range60 * 0.5).toFixed(2),
        'fib_0.618': +(high60 - range60 * 0.618).toFixed(2),
        'fib_1.0_低點': +low60.toFixed(2),
      };
  
      // --- RSI ---
      const rsiPeriod = 14;
      let rsiValue = null;
      if (closes.length >= rsiPeriod + 1) {
        let gains = 0, losses = 0;
        for (let i = closes.length - rsiPeriod; i < closes.length; i++) {
          const diff = closes[i] - closes[i - 1];
          if (diff >= 0) gains += diff; else losses -= diff;
        }
        const avgGain = gains / rsiPeriod;
        const avgLoss = losses / rsiPeriod;
        rsiValue = avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(1);
      }
  
      // --- Volume trend (recent 5-day avg vs 20-day avg) ---
      const vol5 = calcMA(volumes, 5);
      const vol20 = calcMA(volumes, 20);
      const volumeTrend = vol5 && vol20 ? (vol5 > vol20 * 1.3 ? '放量' : vol5 < vol20 * 0.7 ? '縮量' : '正常') : '未知';
  
      // --- Determine trend ---
      const trend = ma5 && ma20
        ? (ma5 > ma20 ? '短期多頭排列' : '短期空頭排列')
        : '趨勢不明';
  
      // --- Left-side (contrarian) entry levels ---
      const leftSide = {
        description: '左側交易（逆勢/抄底）— 在趨勢未確認反轉前提前佈局',
        levels: [
          { name: 'MA20 均線支撐', price: ma20, condition: `股價跌至 MA20 附近（目前 MA20=${ma20}）` },
          ma60 ? { name: 'MA60 季線支撐', price: ma60, condition: `股價跌至季線附近（目前 MA60=${ma60}）` } : null,
          { name: '近20日低點支撐', price: +low20.toFixed(2), condition: `股價接近近期低點 ${low20.toFixed(2)}` },
          { name: 'Fibonacci 0.618 回撤', price: fib['fib_0.618'], condition: `從波段高點回撤 61.8% 至 ${fib['fib_0.618']}` },
          { name: 'Fibonacci 0.5 回撤', price: fib['fib_0.5'], condition: `從波段高點回撤 50% 至 ${fib['fib_0.5']}` },
        ].filter(Boolean).sort((a, b) => b.price - a.price),
      };
  
      // --- Right-side (trend-following) entry levels ---
      const rightSide = {
        description: '右側交易（順勢/追漲）— 確認趨勢反轉後順勢進場',
        levels: [
          { name: '突破 MA5', price: ma5, condition: `股價站上 5 日均線 ${ma5}（短期轉強）` },
          { name: '突破 MA20', price: ma20, condition: `股價站上月線 ${ma20}（中期趨勢翻多）` },
          { name: '突破近20日高點', price: +high20.toFixed(2), condition: `突破近期壓力 ${high20.toFixed(2)}（確認突破）` },
          { name: 'Fibonacci 0.382 回撤突破', price: fib['fib_0.382'], condition: `站上 ${fib['fib_0.382']}（回撤收復）` },
          ma60 ? { name: '站上季線', price: ma60, condition: `股價站上 MA60=${ma60}（中長期轉強）` } : null,
        ].filter(Boolean).sort((a, b) => a.price - b.price),
      };
  
      return {
        code: args.code,
        currentPrice,
        date: sorted[sorted.length - 1].trade_date,
        trend,
        rsi: rsiValue,
        volumeTrend,
        movingAverages: { ma5, ma10, ma20, ma60 },
        fibonacci: fib,
        leftSide,
        rightSide,
        suggestion: currentPrice < ma20
          ? '目前股價低於月線，偏向左側交易機會（逢低佈局）'
          : currentPrice > high20 * 0.98
            ? '目前股價接近近期高點，偏向右側交易確認（等待突破）'
            : '目前股價處於均線與高低點之間，可依個人風格選擇左側或右側策略',
      };
    },

  async get_stock_correlation(args) {
      const codes = args.stocks.split(',').map(c => c.trim());
      const days = args.days || 60;
      const stocks = codes.map(c => ({ code: c, market: /^[A-Z]/.test(c) ? 'US' : 'TW' }));
      const resp = await fetch(`${BASE}/api/correlation/matrix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stocks, days }),
        timeout: 30000,
      });
      if (!resp.ok) return { error: `API returned ${resp.status}` };
      const data = await resp.json();
      // Simplify for LLM
      return {
        stocks: (data.nodes || []).map(n => ({
          code: n.code,
          name: n.name,
          changePercent: n.changePercent,
        })),
        correlations: (data.edges || []).map(e => ({
          pair: `${e.source}-${e.target}`,
          correlation: e.value.toFixed(3),
          strength: e.value >= 0.7 ? '強正相關' : e.value >= 0.3 ? '正相關' : e.value >= -0.3 ? '弱相關' : '負相關',
        })),
        meta: data.meta,
      };
    },

  async get_stock_beta(args) {
      const code = resolveCode(args);
      const market = (args.market || 'TW').toUpperCase();
      const windowDays = parseInt(args.windowDays) || 252;
      if (!code) return { error: 'code 必填' };
      return callInternal(`/api/analysis/beta/${encodeURIComponent(code)}?market=${market}&windowDays=${windowDays}`);
    }
};

module.exports = { definitions, executors };
