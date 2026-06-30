// ============================================
// Copyright (c) 2025-2026 Kevin Lin. All rights reserved.
// AI Tools — research aggregators
//
// 2026-05-18 Sprint B（LLM-backed）：
//   - research_stock_deep_dive: 5-agent debate (Bull/Bear/Sentiment/Risk/Synthesizer)
//   - portfolio_daily_briefing: 每日盤前 / 盤後 portfolio 簡報
//
// 2026-05-18 Sprint C（deterministic aggregators, cost=$0）：
//   - compare_investment_candidates: 並排比較 2-5 檔候選標的
//   - post_trade_review: 過去 N 天交易反思（lessons learned 結構化）
//
// LLM-backed tool 跟 deterministic 的差異：
//   1. LLM-backed 真的打 LLM → 燒錢（見 lib/mcp-meta.js COST_MAP）
//   2. deterministic 純粹並行 fetch 既有 endpoint + 結構化 — 給 agent 一份
//      好讀的 input，由 agent LLM 自己做 reasoning（這樣比較省 token + 讓
//      agent 看得到原始證據而非 LLM-synthesized 結論）
//   3. multi-agent 需 Premium tier，gating 在 route 層（requireTier）；其他 lite
// ============================================
'use strict';

const { postInternal, callInternal, registry: EXECUTORS } = require('../helpers');

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "research_stock_deep_dive",
      "description": "深度個股研究 — 5 個專業 AI agent 並行辯論：🐂 多頭 vs 🐻 空頭 vs 📰 情緒 vs 🛡️ 風險 → 🎯 Synthesizer 整合給 6-level 最終建議（strong_buy / buy / hold / sell / strong_sell / avoid）。比單一 LLM 分析更穩，因為 Bull/Bear 各自只看支持自己論點的證據，Synthesizer 看到兩邊全貌再下結論。回傳每個 agent 的 reasoning + final action + 信心分數。需要 Premium tier — Free / Standard 收到 403。LLM 成本約 $0.16/call。",
      "parameters": {
        "type": "object",
        "properties": {
          "stockId": {
            "type": "string",
            "description": "股票代號，例如 2330 / AAPL"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW",
            "enum": ["TW", "US"]
          },
          "lang": {
            "type": "string",
            "description": "輸出語言 zh 或 en，預設 zh",
            "enum": ["zh", "en"]
          }
        },
        "required": ["stockId"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "portfolio_daily_briefing",
      "description": "每日 portfolio 簡報（盤前 morning / 盤後 evening）— 整合當前持股表現、未實現損益、產業曝險、relevant macro / institutional flow，產出一段 LLM 摘要 + actionable next steps。盤前看「今天該注意什麼」，盤後看「今天發生什麼 + 明天 setup」。預設 mode='get'（讀最新一份）；若指定 mode='generate' 會跑新的一份（~10-20s）。LLM 成本約 $0.04/generate call，get 是 free。",
      "parameters": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "description": "簡報類型 morning（盤前）或 evening（盤後），預設 morning",
            "enum": ["morning", "evening"]
          },
          "mode": {
            "type": "string",
            "description": "get = 讀最新已生成的（free, 即時）; generate = 重新生成一份（會打 LLM, ~10-20s）。預設 get。",
            "enum": ["get", "generate"]
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "compare_investment_candidates",
      "description": "並排比較 2-5 檔候選投資標的的深度分析（升級版 compare_stocks — 後者只看 PE/PB/殖利率，這裡跑 get_full_stock_analysis 拿到 price/technical/chip/fundamentals/levels/institutional/news 全套）+ 自動帶出每檔現有 thesis 狀態。**不打 LLM**（cost=$0），純粹並行 fetch + 結構化；agent 自己看 raw evidence 做 reasoning，token-effective 且避免 LLM-synthesized bias。",
      "parameters": {
        "type": "object",
        "properties": {
          "codes": {
            "type": "string",
            "description": "股票代號（逗號分隔，2-5 檔），例如 2330,2454,3008"
          },
          "market": {
            "type": "string",
            "description": "市場 TW 或 US，預設 TW",
            "enum": ["TW", "US"]
          },
          "include_thesis": {
            "type": "boolean",
            "description": "是否帶出每檔的現有 thesis（投資論點）狀態 — 預設 true"
          },
          "include_news": {
            "type": "boolean",
            "description": "是否含最近 news — 預設 false（news 量大，token 重）"
          }
        },
        "required": ["codes"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "post_trade_review",
      "description": "過去 N 天交易反思 — 把 analyze_trade_performance（FIFO PnL / 勝率 / 平均持有天數）+ get_trade_journal（最近交易紀錄）+ get_portfolio_signals（當前訊號）三份資料結構化成 'lessons learned' 草稿。輸出包含：wins / losses / patterns（盤整時亂操作 / 抱不住贏家 / 凹單等可偵測的習慣）/ recommendations / open_positions_to_review。**不打 LLM**（cost=$0），agent LLM 看結構化 evidence 自己寫 review。",
      "parameters": {
        "type": "object",
        "properties": {
          "days": {
            "type": "integer",
            "description": "回顧區間天數，預設 30，最大 365"
          },
          "market": {
            "type": "string",
            "description": "市場 TW / US / all，預設 all（雙市場）",
            "enum": ["TW", "US", "all"]
          },
          "max_trades": {
            "type": "integer",
            "description": "回傳的最近交易紀錄筆數上限，預設 20（避免 token 爆）"
          }
        }
      }
    }
  }
];

const executors = {
  async research_stock_deep_dive(args = {}) {
    if (!args.stockId) return { error: 'stockId required' };
    // multi-agent 是同步阻塞 LLM call，5 agent 並行也要 30-60s — 拉長 timeout
    return await postInternal('/api/ai/multi-agent-analyze', {
      stockId: String(args.stockId).trim(),
      market: String(args.market || 'TW').toUpperCase(),
      lang: args.lang === 'en' ? 'en' : 'zh',
    }, 120000);
  },

  async portfolio_daily_briefing(args = {}) {
    const type = args.type === 'evening' ? 'evening' : 'morning';
    const mode = args.mode === 'generate' ? 'generate' : 'get';

    if (mode === 'generate') {
      // 重新跑一份 — LLM 計費 + 較慢
      return await postInternal('/api/briefing/generate', { type }, 60000);
    }
    // 預設讀最新一份（不打 LLM，便宜）
    const result = await callInternal(`/api/briefing/latest?type=${type}`);
    if (result && result.empty) {
      return {
        empty: true,
        hint: `尚無 ${type} 簡報。用 mode='generate' 產生第一份（會花 ~10-20s + LLM cost）。`,
      };
    }
    return result;
  },

  // ── Sprint C (2026-05-18) — deterministic aggregators ──

  async compare_investment_candidates(args = {}) {
    const rawCodes = String(args.codes || '').split(',').map(s => s.trim()).filter(Boolean);
    if (rawCodes.length < 2) return { error: 'codes 至少 2 檔（逗號分隔）' };
    if (rawCodes.length > 5) return { error: 'codes 最多 5 檔（避免 token 爆）' };
    const market = String(args.market || 'TW').toUpperCase();
    const includeThesis = args.include_thesis !== false; // 預設 true
    const includeNews = args.include_news === true;       // 預設 false

    // 並行 fetch — get_full_stock_analysis 已經是 fan-out 7 個子 endpoint，再 fan-out 一層
    // 5 檔 × 7 子 = 35 個並行 request；都打 localhost，server 撐得住
    const analyses = await Promise.allSettled(rawCodes.map(code =>
      EXECUTORS.get_full_stock_analysis({
        code,
        market,
        steps: includeNews
          ? ['price', 'technical', 'chip', 'fundamentals', 'levels', 'institutional', 'news']
          : ['price', 'technical', 'chip', 'fundamentals', 'levels', 'institutional'],
      })
    ));

    const theses = includeThesis ? await Promise.allSettled(rawCodes.map(code =>
      EXECUTORS.get_thesis({ stockId: code, market })
    )) : null;

    const candidates = rawCodes.map((code, i) => {
      const a = analyses[i];
      const t = theses ? theses[i] : null;
      const analysis = a.status === 'fulfilled' ? a.value : { error: a.reason?.message || 'fetch failed' };
      const thesis = t ? (t.status === 'fulfilled' ? t.value : null) : null;
      // thesis 可能回 { error: 'not_found' } 之類，做友善包裝
      const hasThesis = thesis && !thesis.error && (thesis.hypothesis || thesis.stockId);

      return {
        code, market,
        analysis,
        thesis: hasThesis ? thesis : { exists: false },
      };
    });

    return {
      market,
      candidatesCount: candidates.length,
      candidates,
      generatedAt: new Date().toISOString(),
      note: '此工具僅彙整原始資料，未做 LLM judgment。Agent 應比對各檔 fundamentals / technicals / chip 後自行下結論。',
    };
  },

  async post_trade_review(args = {}) {
    const days = Math.min(365, Math.max(1, parseInt(args.days) || 30));
    const market = args.market && args.market !== 'all' ? String(args.market).toUpperCase() : null;
    const maxTrades = Math.min(100, Math.max(1, parseInt(args.max_trades) || 20));
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    // 並行：performance / journal / signals
    const [perfR, journalR, signalsR] = await Promise.allSettled([
      EXECUTORS.analyze_trade_performance({
        market: market || undefined,
        startDate,
        endDate,
      }),
      EXECUTORS.get_trade_journal({ limit: maxTrades }),
      EXECUTORS.get_portfolio_signals({ market: market || 'TW' }),
    ]);

    const perf = perfR.status === 'fulfilled' ? perfR.value : { error: perfR.reason?.message };
    const journal = journalR.status === 'fulfilled' ? journalR.value : { error: journalR.reason?.message };
    const signals = signalsR.status === 'fulfilled' ? signalsR.value : { error: signalsR.reason?.message };

    // W22 收斂（2026-06-10 audit）：行為 pattern 改由 investor-memory 單一來源 —
    // 原本這裡內嵌一份偵測，已與 investor-memory 漂移（over_trading 門檻 5 天 vs 10 天、
    // 缺 stoploss_delay / disposition_effect / chasing / emotional 四旗標）。
    let patterns = [];
    try {
      const im = require('../../investor-memory');
      patterns = (im.getBehaviorMirror().patterns || []).map(p => ({
        severity: p.severity,
        label: p.label,
        detail: im.describeBehaviorPattern(p, 'zh'),
      }));
    } catch { patterns = []; }

    return {
      window: { days, startDate, endDate, market: market || 'all' },
      performance: perf,
      recentTrades: Array.isArray(journal) ? journal.slice(0, maxTrades) : journal,
      currentSignals: signals,
      patterns,
      generatedAt: new Date().toISOString(),
      note: '此工具僅彙整原始資料 + 客觀指標 pattern。Agent 應結合此資料寫出敘事性 review（wins / losses / lessons / next steps）。',
    };
  },
};

module.exports = { definitions, executors };
