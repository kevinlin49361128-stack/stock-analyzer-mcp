// Copyright (c) 2025-2026 Kevin Lin. All rights reserved.
// AI Tools — market category
// Auto-split by scripts/split-ai-tools.js (kept manually after split)

'use strict';

const { callInternal, postInternal, putInternal, deleteInternal, resolveCode, registry: EXECUTORS } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "get_stock_price",
      "description": "取得台股即時報價，包含股價、漲跌、漲跌幅、成交量、開高低收",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "台股代號，例如 2330、2317、2454"
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
      "name": "get_us_stock_quote",
      "description": "取得美股即時報價，可同時查詢多檔",
      "parameters": {
        "type": "object",
        "properties": {
          "symbols": {
            "type": "string",
            "description": "美股代號（逗號分隔），例如 AAPL,NVDA,TSLA"
          }
        },
        "required": [
          "symbols"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_price_history",
      "description": "取得股票歷史價格資料（日K線），用於分析趨勢、計算漲跌幅",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "股票代號"
          },
          "days": {
            "type": "number",
            "description": "查詢天數，預設 30"
          },
          "market": {
            "type": "string",
            "description": "市場，TW 或 US，預設 TW"
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
      "name": "get_market_heatmap",
      "description": "取得台股市場熱力圖數據，按產業分組顯示各股漲跌幅與成交量",
      "parameters": {
        "type": "object",
        "properties": {
          "market": {
            "type": "string",
            "description": "市場: tw 或 us，預設 tw"
          }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_market_overview",
      "description": "取得大盤綜覽：三大法人整體動態＋類股強弱排名＋系統性風險指數＋匯率。適合「今天大盤如何？」類型的問題。",
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
      "name": "get_sector_ranking",
      "description": "取得今日各產業漲跌幅排名，判斷資金正在輪動到哪些產業、哪些產業最弱",
      "parameters": {
        "type": "object",
        "properties": {
          "market": {
            "type": "string",
            "description": "市場 tw 或 us，預設 tw"
          },
          "top": {
            "type": "number",
            "description": "顯示前 N 名，預設 10"
          }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_news",
      "description": "搜尋股票或主題的相關新聞",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "搜尋關鍵字，例如「台積電」、「AI伺服器」"
          }
        },
        "required": [
          "query"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_exchange_rate",
      "description": "查詢台幣對美元匯率，用於跨市場投資組合統一計價",
      "parameters": {
        "type": "object",
        "properties": {
          "from": {
            "type": "string",
            "description": "來源幣別，預設 USD",
            "enum": [
              "USD"
            ]
          },
          "to": {
            "type": "string",
            "description": "目標幣別，預設 TWD",
            "enum": [
              "TWD"
            ]
          }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_seasonality",
      "description": "取得單一股票的季節性報酬矩陣（近 N 年每月報酬、各月平均報酬），幫助判斷「哪幾月該進/該出」。",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "股票代號"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
          },
          "years": {
            "type": "number",
            "description": "回顧年數（3-20，預設 10）"
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
      "name": "compare_stocks",
      "description": "並排比較多檔股票的關鍵指標：股價表現、本益比(PE)、股價淨值比(PB)、股息殖利率，快速找出相對便宜或強勢的標的",
      "parameters": {
        "type": "object",
        "properties": {
          "codes": {
            "type": "string",
            "description": "股票代號（逗號分隔，2-5 檔），例如 2330,2454,2317"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW"
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
      "name": "get_stock_radar",
      "description": "取得個股多維度雷達圖評分（成長力、獲利品質、籌碼強度、技術動能、估值合理性等 6 軸）。快速判斷個股的綜合素質，適合「這檔股票各方面表現如何」的問題。目前僅支援台股（TW）。",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "台股代號，例如 2330"
          },
          "market": {
            "type": "string",
            "description": "市場，目前支援 TW，預設 TW"
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
      "name": "get_etf_holdings",
      "description": "取得 ETF 的前十大持股",
      "parameters": {
        "type": "object",
        "properties": {
          "symbol": {
            "type": "string",
            "description": "ETF 代號，例如 0050.TW 或 SPY"
          }
        },
        "required": [
          "symbol"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_trading_day_status",
      "description": "查詢交易日狀態：當前是否開市、最近交易日、最近 5 個交易日清單、下個預期開市日。以本地 daily_prices 為實際成交日來源，國定假日推算為粗估。",
      "parameters": {
        "type": "object",
        "properties": {
          "market": {
            "type": "string",
            "description": "市場：TW（台股，預設）或 US（美股）"
          }
        }
      }
    }
  }
];

const executors = {
  async get_stock_price(args) {
      const data = await callInternal(`/api/tw/realtime/${args.code}`);
      if (data.error) return data;
      const q = data.quote || data;
      return {
        code: args.code,
        name: q.name,
        price: q.price,
        change: q.change,
        changePct: q.changePct,
        open: q.open,
        high: q.high,
        low: q.low,
        volume: q.volume,
        marketState: q.marketState,
        // 補強（C1/C2）：保留底層降級事實（報價走 DB fallback 才有），別在 executor 洗白——
        // MCP provenance 會把它鏡射成 resultStatus，讓 LLM 一眼看到「這顆是備援/非即時」。
        ...(q.source !== undefined ? { source: q.source } : {}),
        ...(q.stale !== undefined ? { stale: q.stale } : {}),
        ...(q.provisional !== undefined ? { provisional: q.provisional } : {}),
      };
    },

  async get_us_stock_quote(args) {
      const data = await callInternal(`/api/us/quote?symbols=${args.symbols}`);
      if (data.error) return data;
      // Simplify
      if (Array.isArray(data)) {
        return data.map(q => ({
          symbol: q.symbol,
          name: q.shortName || q.longName,
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePct: q.regularMarketChangePercent,
          volume: q.regularMarketVolume,
          marketCap: q.marketCap,
        }));
      }
      return data;
    },

  async get_price_history(args) {
      const days = args.days || 30;
      const market = args.market || 'TW';
      const data = await callInternal(`/api/db/prices/${args.stockId}?days=${days}&market=${market}&autofill=1`);
      if (data.error) return data;
      if (Array.isArray(data) && data.length > 0) {
        // Return summary + last 10 data points to save context
        const last10 = data.slice(-10);
        const first = data[0];
        const last = data[data.length - 1];
        const periodChange = first.close_price > 0
          ? ((last.close_price - first.close_price) / first.close_price * 100).toFixed(2)
          : 'N/A';
        return {
          totalDays: data.length,
          periodStart: first.trade_date,
          periodEnd: last.trade_date,
          periodChangePercent: periodChange,
          highestClose: Math.max(...data.map(d => d.close_price)),
          lowestClose: Math.min(...data.map(d => d.close_price)),
          avgVolume: Math.round(data.reduce((s, d) => s + d.volume, 0) / data.length),
          recentData: last10.map(d => ({
            date: d.trade_date,
            close: d.close_price,
            volume: d.volume,
          })),
        };
      }
      return { message: '無歷史資料，可能需要先同步', data };
    },

  async get_market_heatmap(args) {
      const market = args.market || 'tw';
      const data = await callInternal(`/api/heatmap/${market}`);
      if (data.error) return data;
      // Summarize by sector
      if (data.groups && Array.isArray(data.groups)) {
        return {
          updatedAt: data.updatedAt,
          sectors: data.groups.map(g => {
            const stocks = g.stocks || [];
            const avgChange = stocks.length > 0
              ? (stocks.reduce((s, st) => s + (st.changePercent || 0), 0) / stocks.length).toFixed(2)
              : 0;
            const topGainers = stocks.filter(s => s.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
            const topLosers = stocks.filter(s => s.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);
            return {
              name: g.name,
              stockCount: stocks.length,
              avgChangePercent: avgChange,
              topGainers: topGainers.map(s => ({ code: s.code, name: s.name, change: s.changePercent + '%' })),
              topLosers: topLosers.map(s => ({ code: s.code, name: s.name, change: s.changePercent + '%' })),
            };
          }).slice(0, 10),
        };
      }
      return data;
    },

  async get_market_overview() {
      const [institutional, sector, risk, fx] = await Promise.allSettled([
        EXECUTORS.get_institutional_flow({}),
        EXECUTORS.get_sector_ranking({ topN: 5 }),
        EXECUTORS.get_market_sentiment({}),
        EXECUTORS.get_exchange_rate({}),
      ]);
      return {
        institutional: institutional.status === 'fulfilled' ? institutional.value : { error: institutional.reason?.message },
        sectorRanking: sector.status === 'fulfilled' ? sector.value : { error: sector.reason?.message },
        marketSentiment: risk.status === 'fulfilled' ? risk.value : { error: risk.reason?.message },
        exchangeRate:  fx.status === 'fulfilled' ? fx.value : { error: fx.reason?.message },
      };
    },

  async get_sector_ranking(args) {
      const market = args.market || 'tw';
      const top = Math.min(args.top || 10, 20);
      const data = await callInternal(`/api/heatmap/${market}`);
      if (data.error) return data;
      if (!data.groups || !Array.isArray(data.groups)) return { error: '無法取得產業資料' };
  
      const sectors = data.groups
        .map(group => {
          const stocks = group.stocks || [];
          if (!stocks.length) return null;
          const validStocks = stocks.filter(s => s.changePercent != null);
          if (!validStocks.length) return null;
          const avgChange = validStocks.reduce((s, st) => s + st.changePercent, 0) / validStocks.length;
          const risers = stocks.filter(s => (s.changePercent || 0) > 0).length;
          const fallers = stocks.filter(s => (s.changePercent || 0) < 0).length;
          const sorted = [...stocks].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
          return {
            sector: group.name,
            avgChange: parseFloat(avgChange.toFixed(2)),
            stockCount: stocks.length,
            risers,
            fallers,
            topGainer: sorted[0] ? `${sorted[0].name}(${sorted[0].changePercent?.toFixed(1)}%)` : null,
            topLoser: sorted[sorted.length - 1] ? `${sorted[sorted.length - 1].name}(${sorted[sorted.length - 1].changePercent?.toFixed(1)}%)` : null,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.avgChange - a.avgChange);
  
      return {
        market: market.toUpperCase(),
        date: data.date || new Date().toISOString().slice(0, 10),
        leading: sectors.slice(0, top),
        lagging: sectors.slice(-Math.min(5, sectors.length)).reverse(),
      };
    },

  async get_news(args) {
      const data = await callInternal(`/api/news/${encodeURIComponent(args.query)}`);
      if (data.error) return data;
      if (Array.isArray(data)) {
        return data.slice(0, 8).map(n => ({
          title: n.title,
          source: n.source,
          pubDate: n.pubDate,
          link: n.link,
        }));
      }
      return data;
    },

  async get_exchange_rate(args) {
      const from = args.from || 'USD';
      const to = args.to || 'TWD';
      const data = await callInternal(`/api/exchange/rate?from=${from}&to=${to}`);
      if (data.error) return data;
      return {
        from: data.from,
        to: data.to,
        rate: data.rate.toFixed(4),
        timestamp: data.timestamp,
        source: data.source,
        formatted: `1 ${data.from} = ${data.rate.toFixed(4)} ${data.to}`,
      };
    },

  async get_seasonality(args) {
      const code = resolveCode(args);
      if (!code) return { error: 'code 必填' };
      const market = (args.market || 'TW').toUpperCase();
      const years = Math.max(3, Math.min(20, parseInt(args.years) || 10));
      const data = await callInternal(`/api/seasonality/${code}?market=${market}&years=${years}`);
      if (data.error) return data;
      return {
        code: data.code,
        market: data.market,
        years,
        monthAvg: data.monthAvg,
        matrix: Array.isArray(data.matrix) ? data.matrix.slice(-years) : [],
        note: 'monthAvg 為近 N 年各月平均報酬 %，index 0 = 1 月',
      };
    },

  async compare_stocks(args) {
      if (!args.codes) return { error: 'codes 參數必填（逗號分隔股票代號，例如 2330,2454）' };
      const codes = args.codes.split(',').map(c => c.trim()).filter(Boolean).slice(0, 5);
      const market = (args.market || 'TW').toUpperCase();
  
      const results = await Promise.all(codes.map(async (code) => {
        const [quoteRaw, fundRaw, histResp] = await Promise.all([
          market === 'TW'
            ? callInternal(`/api/tw/realtime/${code}`)
            : callInternal(`/api/us/quote?symbols=${code}`),
          callInternal(`/api/fundamental/${code}?type=valuation`),
          callInternal(`/api/db/prices/${code}?days=30&market=${market}&autofill=1`),
        ]);
  
        // 報價 — /api/tw/realtime returns {quote:{...}}
        let price = null, change1d = null;
        if (market === 'TW') {
          const q = quoteRaw.quote || quoteRaw;
          price = q.price;
          change1d = q.changePct;
        } else {
          const q = Array.isArray(quoteRaw) ? quoteRaw[0] : quoteRaw;
          price = q?.regularMarketPrice;
          change1d = q?.regularMarketChangePercent;
        }
  
        // 近 1 個月漲跌幅
        const hist = Array.isArray(histResp) ? histResp : (histResp.data || []);
        let change1m = null;
        if (hist.length >= 2) {
          const f = hist[0].close_price, l = hist[hist.length - 1].close_price;
          change1m = parseFloat(((l - f) / f * 100).toFixed(2));
        }
  
        // 估值
        const val = fundRaw.valuation || {};
        return {
          code,
          price,
          change1d: change1d != null ? parseFloat(parseFloat(change1d).toFixed(2)) : null,
          change1m,
          pe: val.per ? parseFloat(parseFloat(val.per).toFixed(1)) : null,
          pb: val.pbr ? parseFloat(parseFloat(val.pbr).toFixed(2)) : null,
          divYield: val.dividendYield ? `${parseFloat(val.dividendYield).toFixed(2)}%` : null,
        };
      }));
  
      return { market, stocks: results };
    },

  async get_stock_radar(args) {
      const code = resolveCode(args);
      const market = (args.market || 'TW').toUpperCase();
      if (!code) return { error: 'code 必填' };
      return callInternal(`/api/radar/${encodeURIComponent(code)}?market=${market}`);
    },

  async get_etf_holdings(args) {
      const data = await callInternal(`/api/etf/holdings/${args.symbol}`);
      if (data.error) return data;
      return data;
    },

  // 2026-05-16: holiday / trading-day awareness (inspired by CasualMarket MCP)
  // 以 SAA 本地 daily_prices 表為真實 source — 不靠硬編碼假日清單
  async get_trading_day_status(args) {
      const market = (args.market || 'TW').toUpperCase();
      const stockId = market === 'TW' ? '^TWII' : 'SPY';
      // 抓最近 10 個交易日（含日期）
      const data = await callInternal(`/api/db/prices/${stockId}?market=${market}&limit=10`);
      const rows = data?.data || data?.prices || [];
      if (rows.length === 0) {
        return { market, error: 'No trading day data available', is_open_now: false };
      }
      const lastDate = rows[0]?.trade_date || rows[0]?.date;
      // is_open_now：藉 /api/system/health 拿（health 回 scheduler.twMarketOpen/usMarketOpen 扁平欄位，
      // 非 markets[x].isOpen —— 原本取錯路徑導致永遠 null，隱形壞）
      const sysInfo = await callInternal(`/api/system/health`).catch(() => null);
      const isOpenNow = sysInfo?.scheduler
        ? (market.toLowerCase() === 'tw' ? sysInfo.scheduler.twMarketOpen : sysInfo.scheduler.usMarketOpen) ?? null
        : null;

      // 推算下個預期開市日（簡單：今天 weekday 接著找下個工作天，未含假日精確判斷）
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      while ([0, 6].includes(tomorrow.getDay())) tomorrow.setDate(tomorrow.getDate() + 1);
      const nextEstimatedOpen = tomorrow.toISOString().slice(0, 10);

      return {
        market,
        is_open_now: isOpenNow,
        last_trading_day: lastDate,
        recent_trading_days: rows.slice(0, 5).map(r => r.trade_date || r.date),
        next_estimated_open: nextEstimatedOpen,
        note: 'next_estimated_open 僅以星期幾推算，未含國定假日精確判斷；以 daily_prices 為實際成交日來源'
      };
    }
};

module.exports = { definitions, executors };
