// Copyright (c) 2025-2026 Kevin Lin. All rights reserved.
// AI Tools — portfolio category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { callInternal, postInternal, putInternal, deleteInternal, resolveCode } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "get_portfolio",
      "description": "取得使用者的投資組合（持股明細、成本、現值、損益）",
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
      "name": "get_pnl_realized",
      "description": "取得已實現損益報告：每檔股票的已結算獲利/虧損金額、報酬率、持有天數。適合回答「我賺錢的股票有哪些」「哪些交易虧了多少」。",
      "parameters": {
        "type": "object",
        "properties": {
          "market": {
            "type": "string",
            "description": "市場篩選 TW 或 US，空白則兩個市場都回傳"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_portfolio_performance",
      "description": "取得投資組合的完整績效曲線與統計指標：總報酬率、CAGR、最大回撤、夏普比率、波動度、勝率；並附上與台股大盤（TWII）、S&P500、散戶指數的比較曲線及每筆交易標記。適合回答「我的整體投資績效如何」「跑贏大盤了嗎」。",
      "parameters": {
        "type": "object",
        "properties": {
          "days": {
            "type": "number",
            "description": "回顧天數，252=1年 / 504=2年 / 1008=4年 / 2520=10年 / 5000=全部；預設 2520"
          },
          "benchmark": {
            "type": "boolean",
            "description": "是否附上基準比較曲線，預設 true"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_portfolio_score",
      "description": "取得投資組合綜合評分與投資人等級（新手/穩健/進階/專業），以及多個維度的量化指標。可讓 LLM 瞭解用戶投資水準，調整建議深度與語氣。",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_portfolio_concentration",
      "description": "分析目前投資組合的集中度風險，回傳 Herfindahl 指數、前 N 大部位佔比、集中度警示與建議（例如單一股票占比過高）。資料來自使用者實際持股，以台幣計價。",
      "parameters": {
        "type": "object",
        "properties": {
          "topN": {
            "type": "number",
            "description": "前 N 大部位要呈現（1-20，預設 5）"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_portfolio_signals",
      "description": "取得持倉個股的量化信號警示：超買/超賣、突破、籌碼異動等。由後台分析引擎定期運算，可快速掌握需要關注的個股。",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "指定股票代號（選填，不填則取全部持倉）"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "add_trade",
      "description": "新增一筆交易記錄到持倉（買入或賣出），執行前會請使用者確認。必填：stockId、market、action（buy/sell）、shares、price、tradeDate。",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "股票代號，例如 2330"
          },
          "market": {
            "type": "string",
            "description": "TW 或 US"
          },
          "action": {
            "type": "string",
            "description": "buy 或 sell"
          },
          "shares": {
            "type": "number",
            "description": "股數（台股為整數張數×1000）"
          },
          "price": {
            "type": "number",
            "description": "成交價格"
          },
          "tradeDate": {
            "type": "string",
            "description": "交易日期 YYYY-MM-DD"
          },
          "note": {
            "type": "string",
            "description": "備註（選填）"
          }
        },
        "required": [
          "stockId",
          "market",
          "action",
          "shares",
          "price",
          "tradeDate"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_trade",
      "description": "修改一筆已存在的交易紀錄（依 transaction id）。執行前會請使用者確認。可修改 shares / price / tradeDate / note。",
      "parameters": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number",
            "description": "交易 id（必填）；可從 get_trade_journal 取得"
          },
          "shares": {
            "type": "number",
            "description": "新股數（選填）"
          },
          "price": {
            "type": "number",
            "description": "新成交價（選填）"
          },
          "tradeDate": {
            "type": "string",
            "description": "新交易日期 YYYY-MM-DD（選填）"
          },
          "note": {
            "type": "string",
            "description": "新備註（選填）"
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
      "name": "delete_trade",
      "description": "刪除一筆已存在的交易紀錄（依 transaction id）。執行前會請使用者確認。此操作不可逆。",
      "parameters": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number",
            "description": "交易 id（必填）；可從 get_trade_journal 取得"
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
      "name": "get_trade_journal",
      "description": "查詢交易日誌 — 取得過去交易的決策快照與市場情境記錄",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "股票代號（可選，不填則回傳全部）"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US"
          },
          "limit": {
            "type": "number",
            "description": "筆數上限，預設 10"
          }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "analyze_trade_performance",
      "description": "根據使用者實際交易紀錄做績效分析（回測的升級版）：以 FIFO 配對買進/賣出，計算已實現損益、勝率、平均持有天數、平均單筆報酬、最佳/最差交易、每檔股票表現、未實現損益。比純粹看持倉損益更能回答「我的選股/擇時策略有效嗎」。",
      "parameters": {
        "type": "object",
        "properties": {
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，不填則兩市場一起算"
          },
          "stockId": {
            "type": "string",
            "description": "指定單一股票代號（選填）"
          },
          "startDate": {
            "type": "string",
            "description": "起始日期 YYYY-MM-DD（選填，預設不限）"
          },
          "endDate": {
            "type": "string",
            "description": "結束日期 YYYY-MM-DD（選填，預設今日）"
          }
        }
      }
    }
  }
];

const executors = {
  async get_portfolio(args = {}) {
      const market = String(args.market || 'all').toLowerCase();
      const data = await callInternal('/api/positions');
      if (data.error) return data;
      const result = { fetchedAt: data.fetchedAt, market };
      const includeTw = market === 'all' || market === 'tw';
      const includeUs = market === 'all' || market === 'us';
  
      // Fetch USD/TWD for cross-market allocation
      let fxRate = null, fxSource = null, fxTimestamp = null;
      try {
        const exchangeRate = require('../../exchange-rate');
        const fx = await exchangeRate.getExchangeRate('USD', 'TWD');
        if (fx && fx.rate > 0) {
          fxRate = Number(fx.rate);
          fxSource = fx.source;
          fxTimestamp = fx.timestamp;
        }
      } catch (err) {
        console.warn('get_portfolio: 匯率獲取失敗，將僅以原幣別輸出:', err.message);
      }
  
      if (includeTw && data.tw && data.tw.length > 0) {
        result.twStocks = data.tw.map(s => ({
          code: s.stock_id,
          shares: s.shares,
          costPrice: s.cost_price,
          currentPrice: s.current_price,
          currentValue: s.current_value,
          currency: 'TWD',
          currentValueTwd: Number(s.current_value || 0),
          pnl: s.pnl,
          pnlPercent: s.pnl_pct,
        }));
      }
      if (includeUs && data.us && data.us.length > 0) {
        result.usStocks = data.us.map(s => ({
          symbol: s.stock_id,
          shares: s.shares,
          costPrice: s.cost_price,
          currentPrice: s.current_price,
          currentValue: s.current_value,
          currency: 'USD',
          currentValueTwd: fxRate ? Number(s.current_value || 0) * fxRate : null,
          pnl: s.pnl,
          pnlPercent: s.pnl_pct,
        }));
      }
      const fullSummary = data.summary || {};
      const twTotal = includeTw ? Number(fullSummary.twTotal || 0) : 0;
      const usTotal = includeUs ? Number(fullSummary.usTotal || 0) : 0;
      const usTotalTwd = fxRate ? usTotal * fxRate : null;
      result.summary = {
        twTotal: includeTw ? fullSummary.twTotal : undefined,
        usTotal: includeUs ? fullSummary.usTotal : undefined,
        usTotalTwd,
        combinedTotalTwd: fxRate ? (twTotal + usTotalTwd) : null,
        realizedPnl: fullSummary.realizedPnl,
      };
      result.fx = fxRate ? { pair: 'USD/TWD', rate: fxRate, source: fxSource, timestamp: fxTimestamp } : { error: 'fx-unavailable' };
      return result;
    },

  async get_pnl_realized(args = {}) {
      const market = args.market ? `?market=${String(args.market).toUpperCase()}` : '';
      return callInternal(`/api/pnl/realized${market}`);
    },

  async get_portfolio_performance(args = {}) {
      const days = Math.min(5000, Math.max(30, parseInt(args.days) || 2520));
      const benchmark = args.benchmark !== false ? '1' : '0';
      const data = await callInternal(`/api/portfolio/value-history?days=${days}&benchmark=${benchmark}`, 45000);
      if (data.error) return data;
      // 只回傳統計指標 + 最近曲線（避免幾千筆資料超出 context）
      const { stats, curve, benchmark: bm, txMarkers } = data;
      const recentCurve = Array.isArray(curve) ? curve.slice(-60) : [];
      return { stats, recentCurve, txMarkersCount: (txMarkers || []).length, benchmark: bm ? Object.keys(bm) : [] };
    },

  async get_portfolio_score(args = {}) {
      return callInternal('/api/portfolio/score', 20000);
    },

  async get_portfolio_concentration(args) {
      const topN = Math.max(1, Math.min(20, parseInt(args?.topN) || 5));
      const data = await callInternal(`/api/portfolio/concentration?topN=${topN}`);
      if (data.error) return data;
      if (data.hasData === false) {
        return { hasData: false, reason: data.reason || 'no_positions', message: '目前無持股可分析' };
      }
      // 精簡回傳避免塞爆 context
      return {
        hasData: true,
        positionsCount: data.positionsCount,
        totalValueTwd: data.totalValueTwd,
        herfindahl: data.herfindahl,
        herfindahlLevel: data.herfindahlLevel,
        topN: data.topN,
        topNShare: data.topNShare,
        topPositions: (data.topPositions || []).slice(0, 10).map(p => ({
          stock_id: p.stock_id,
          market: p.market,
          name: p.name,
          share: p.share,
          value_twd: p.value_twd,
        })),
        observations: data.observations || [],
        fxRate: data.fxRate,
      };
    },

  async get_portfolio_signals(args = {}) {
      const market = (args.market || 'TW').toUpperCase();
      if (args.stockId) {
        return callInternal(`/api/portfolio-analyst/signals/${encodeURIComponent(args.stockId)}?market=${market}`);
      }
      return callInternal(`/api/portfolio-analyst/signals?market=${market}`);
    },

  async add_trade(args) {
      const code = resolveCode(args) || args.stockId;
      const shares = Number(args.shares) || 0;
      const price = Number(args.price) || 0;
      const gross = shares * price;
      const fee = Math.round(gross * 0.001425);
      const tax = args.action === 'sell' ? Math.round(gross * 0.003) : 0;
      const net = args.action === 'buy' ? gross + fee : gross - fee - tax;
  
      if (args.preview) {
        return {
          preview: true,
          action: args.action === 'buy' ? '買入' : '賣出',
          stockId: code,
          market: args.market || 'TW',
          shares,
          price,
          tradeDate: args.tradeDate || new Date().toISOString().slice(0, 10),
          estimatedGross: gross,
          estimatedFee: fee,
          estimatedTax: tax,
          estimatedNet: net,
          confirm_hint: '確認無誤後，以 preview:false 重新呼叫此工具執行交易',
        };
      }
  
      return {
        __pending_action: true,
        tool: 'add_trade',
        params: { ...args, stockId: code },
        description: `新增交易記錄：${args.action === 'buy' ? '買入' : '賣出'} ${code}（${args.market || 'TW'}）${shares} 股 @ ${price}，預估${args.action === 'buy' ? '成本' : '收益'} NT$${net.toLocaleString()}`,
      };
    },

  async update_trade(args) {
      if (!args?.id) return { error: 'id 必填' };
      const patch = {};
      if (args.shares    != null) patch.shares    = Number(args.shares);
      if (args.price     != null) patch.price     = Number(args.price);
      if (args.tradeDate != null) patch.tradeDate = String(args.tradeDate);
      if (args.note      != null) patch.note      = String(args.note);
      if (Object.keys(patch).length === 0) return { error: '沒有任何欄位可更新' };
  
      return {
        __pending_action: true,
        tool: 'update_trade',
        params: { id: args.id, ...patch },
        description: `修改交易 #${args.id}：` + Object.entries(patch).map(([k, v]) => `${k}→${v}`).join('，'),
      };
    },

  async delete_trade(args) {
      if (!args?.id) return { error: 'id 必填' };
      return {
        __pending_action: true,
        tool: 'delete_trade',
        params: { id: args.id },
        description: `刪除交易 #${args.id}（此操作不可逆）`,
      };
    },

  async get_trade_journal(args) {
      try {
        const database = require('../../database');
        const { getRecentJournal, getJournalEntries } = require('../../trade-journal-agent');
  
        if (args.stockId) {
          return getJournalEntries(database, args.stockId, args.market || 'TW', args.limit || 10);
        }
        return getRecentJournal(database, args.limit || 10);
      } catch (e) {
        return { error: `交易日誌查詢失敗: ${e.message}` };
      }
    },

  async analyze_trade_performance(args) {
      try {
        // 取得交易歷史（拿全部，前端/後端還沒支援日期篩選參數就自己 filter）
        const all = await callInternal('/api/transactions');
        if (all.error) return all;
        let txs = Array.isArray(all) ? all : (all.data || []);
  
        if (args?.market)    txs = txs.filter(t => (t.market || 'TW') === args.market.toUpperCase());
        if (args?.stockId)   txs = txs.filter(t => String(t.stock_id) === String(args.stockId));
        if (args?.startDate) txs = txs.filter(t => (t.trade_date || '') >= args.startDate);
        if (args?.endDate)   txs = txs.filter(t => (t.trade_date || '') <= args.endDate);
  
        if (!txs.length) {
          return { hasData: false, message: '依篩選條件沒有交易紀錄' };
        }
  
        // 依 stock 分組，日期升序
        const byStock = new Map();
        for (const t of txs) {
          const key = `${t.market || 'TW'}:${t.stock_id}`;
          if (!byStock.has(key)) byStock.set(key, []);
          byStock.get(key).push(t);
        }
        for (const arr of byStock.values()) {
          arr.sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)));
        }
  
        // FIFO 配對買賣
        const closedTrades = [];   // { stockId, market, entryDate, exitDate, shares, entryPrice, exitPrice, pnl, returnPct, holdDays }
        const openPositions = []; // { stockId, market, shares, avgCost, entryDate }
  
        for (const [key, arr] of byStock.entries()) {
          const [market, stockId] = key.split(':');
          const queue = []; // { shares, price, date }
          for (const t of arr) {
            const action = String(t.action || '').toLowerCase();
            const shares = Number(t.shares || 0);
            const price = Number(t.price || 0);
            const date = t.trade_date;
            if (shares <= 0 || price <= 0) continue;
  
            if (action === 'buy') {
              queue.push({ shares, price, date });
            } else if (action === 'sell') {
              let remaining = shares;
              while (remaining > 0 && queue.length > 0) {
                const lot = queue[0];
                const matched = Math.min(lot.shares, remaining);
                const entryPrice = lot.price;
                const exitPrice = price;
                const pnl = matched * (exitPrice - entryPrice);
                const returnPct = entryPrice > 0 ? ((exitPrice / entryPrice - 1) * 100) : 0;
                const entryTs = Date.parse(lot.date);
                const exitTs  = Date.parse(date);
                const holdDays = (isFinite(entryTs) && isFinite(exitTs)) ? Math.round((exitTs - entryTs) / 86400000) : null;
                closedTrades.push({
                  stockId, market,
                  entryDate: lot.date, exitDate: date,
                  shares: matched,
                  entryPrice: Number(entryPrice.toFixed(4)),
                  exitPrice: Number(exitPrice.toFixed(4)),
                  pnl: Number(pnl.toFixed(2)),
                  returnPct: Number(returnPct.toFixed(2)),
                  holdDays,
                });
                lot.shares -= matched;
                remaining  -= matched;
                if (lot.shares <= 0) queue.shift();
              }
              // 若 remaining > 0 → 賣超（通常不會發生，忽略）
            }
          }
          // 剩下的就是 open positions
          if (queue.length > 0) {
            const totalShares = queue.reduce((s, l) => s + l.shares, 0);
            const totalCost   = queue.reduce((s, l) => s + l.shares * l.price, 0);
            openPositions.push({
              stockId, market,
              shares: totalShares,
              avgCost: Number((totalCost / Math.max(totalShares, 1)).toFixed(4)),
              entryDate: queue[0].date,
            });
          }
        }
  
        // 總體統計
        const totalClosed = closedTrades.length;
        const wins = closedTrades.filter(t => t.pnl > 0);
        const losses = closedTrades.filter(t => t.pnl < 0);
        const totalPnl = closedTrades.reduce((s, t) => s + t.pnl, 0);
        const avgReturn = totalClosed > 0 ? closedTrades.reduce((s, t) => s + t.returnPct, 0) / totalClosed : 0;
        const avgHoldDays = totalClosed > 0
          ? closedTrades.filter(t => t.holdDays != null).reduce((s, t) => s + t.holdDays, 0) /
            Math.max(1, closedTrades.filter(t => t.holdDays != null).length)
          : 0;
        const best  = closedTrades.slice().sort((a, b) => b.returnPct - a.returnPct)[0] || null;
        const worst = closedTrades.slice().sort((a, b) => a.returnPct - b.returnPct)[0] || null;
  
        // 每檔股票表現
        const perStock = {};
        for (const t of closedTrades) {
          const k = `${t.market}:${t.stockId}`;
          if (!perStock[k]) perStock[k] = { stockId: t.stockId, market: t.market, trades: 0, pnl: 0, wins: 0, totalReturn: 0 };
          perStock[k].trades++;
          perStock[k].pnl += t.pnl;
          if (t.pnl > 0) perStock[k].wins++;
          perStock[k].totalReturn += t.returnPct;
        }
        const perStockSummary = Object.values(perStock).map(s => ({
          ...s,
          pnl: Number(s.pnl.toFixed(2)),
          winRate: Number(((s.wins / s.trades) * 100).toFixed(1)) + '%',
          avgReturnPct: Number((s.totalReturn / s.trades).toFixed(2)) + '%',
        })).sort((a, b) => b.pnl - a.pnl);
  
        return {
          filters: {
            market:    args?.market || 'ALL',
            stockId:   args?.stockId || 'ALL',
            startDate: args?.startDate || null,
            endDate:   args?.endDate   || null,
          },
          summary: {
            totalTransactions: txs.length,
            closedTrades:  totalClosed,
            openPositions: openPositions.length,
            realizedPnl: Number(totalPnl.toFixed(2)),
            winRate: totalClosed > 0 ? Number(((wins.length / totalClosed) * 100).toFixed(1)) + '%' : 'N/A',
            winCount:  wins.length,
            lossCount: losses.length,
            avgReturnPct: Number(avgReturn.toFixed(2)) + '%',
            avgHoldDays: Math.round(avgHoldDays),
            bestTrade:  best  ? { stockId: best.stockId,  returnPct: best.returnPct  + '%', pnl: best.pnl,  entryDate: best.entryDate,  exitDate: best.exitDate  } : null,
            worstTrade: worst ? { stockId: worst.stockId, returnPct: worst.returnPct + '%', pnl: worst.pnl, entryDate: worst.entryDate, exitDate: worst.exitDate } : null,
          },
          perStock: perStockSummary.slice(0, 20),
          openPositions: openPositions.slice(0, 20),
          note: '採 FIFO 配對。總損益為已實現 P&L（未含手續費/稅），單位依市場原幣。未實現部位另列於 openPositions。',
        };
      } catch (e) {
        return { error: `分析失敗: ${e.message}` };
      }
    }
};

module.exports = { definitions, executors };
