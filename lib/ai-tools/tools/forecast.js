// Copyright (c) 2025-2026 Kevin Lin. All rights reserved.
// AI Tools — forecast category（2026-06-30）
//
// 把近期分析波（GBM 機率錐 / 前瞻校準帳本 / 盤前脈絡 / 情境實驗室）曝光給 MCP 代理。
// 動機：MCP 客端能對個股做幾十種分析，卻拿不到「前瞻視角」與「這前瞻過去多準」——
//   這正是 SAA 招牌（會給機率錐、又誠實自證校準）在代理面的缺口。
// 合規：全部描述性框架——機率錐=不確定性範圍非買賣建議、方向機率≈50% 屬常態、
//   情境=IF→THEN 機械後果非事件機率。provenance 信封由 MCP 邊界自動掛（lib/provenance.js）。

'use strict';

// 公開 repo 版：引擎改 lazy require（在 executor 內），避免本機 server 啟動時就硬載
// app-only 的 prediction-gbm（此 repo 為 HTTP-proxy 鏡像，分析 lib 在隨附的 SAA 主程式內）。
let _gbmEngine = null;
function _engine() {
  if (!_gbmEngine) { const MonteCarloGBMEngine = require('../../prediction-gbm'); _gbmEngine = new MonteCarloGBMEngine(); }
  return _gbmEngine;
}

const definitions = [
  {
    "type": "function",
    "function": {
      "name": "get_price_forecast",
      "description": "個股未來價格機率錐（GBM 蒙地卡羅，白盒）：輸入股票代號，回傳未來 N 個交易日每日的中位數、上漲機率、50/80/90% 信賴帶（價位），以及波動模型參數與市場狀態（regime）。機率錐是不確定性範圍、非買賣建議；上漲機率接近 50% 屬常態，不代表方向判斷。此模型在實際持股上的前瞻校準戰績請另用 get_forecast_calibration 查核。",
      "parameters": {
        "type": "object",
        "properties": {
          "code": { "type": "string", "description": "股票代號，例如 2330（台股）或 NVDA（美股）" },
          "market": { "type": "string", "description": "市場 TW 或 US，預設 TW" },
          "daysAhead": { "type": "number", "description": "預測天數（交易日，1-20），預設 7" }
        },
        "required": ["code"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_forecast_calibration",
      "description": "預測校準戰績（前瞻記錄帳本，不可作弊）：每日盤後機械記錄當下的機率錐，到期才對帳。回傳 80% 名目信賴帶的實際覆蓋率、方向命中率、校準漂移（覆蓋偏離名目的程度）與樣本數。給 code 查單檔，不給則回投組聚合 + 各檔摘要。這是「我這前瞻過去多準」的可驗證事實，非預測未來、非投資建議；方向命中≈50% 屬常態（機率錐衡量不確定性、非方向賭注）。",
      "parameters": {
        "type": "object",
        "properties": {
          "code": { "type": "string", "description": "股票代號；省略則回投組所有持股的聚合校準" },
          "market": { "type": "string", "description": "市場 TW 或 US，預設 TW（給 code 時才用）" },
          "sinceDays": { "type": "number", "description": "回溯天數，預設 365" }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_preopen_context",
      "description": "台股盤前脈絡（跨市場領先落後 → 大盤開盤參考範圍）：用隔夜美股指數（費半/標普/道瓊/那斯達克/VIX，含 R² 解釋力加權）對加權指數做領先回歸，回傳今日大盤的參考點位區間（中心 ± blend-σ 帶）、主導指數與解釋力、除息機械拖累 footnote。並行市場（日經/韓綜）誠實降權不當領先。這是描述性的「參考範圍」非「預測」、非投資建議，每筆均附 R² 與免責。僅台股（依賴隔夜美股的非重疊領先結構）。",
      "parameters": {
        "type": "object",
        "properties": {
          "days": { "type": "number", "description": "回歸用的歷史交易日數（250-2600），預設 1500" }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "run_scenario",
      "description": "情境壓力傳播（IF→THEN，讀你真實持倉）：注入假設（個股/族群/市場跌幅、匯率衝擊、波動與相關性 regime），機械傳播到投組市值衝擊、觸發的出場條件、集中度 HHI 變化、參數 VaR（前/後）與逐股衝擊。最有價值的是危機 regime（波動爆 + 相關性趨同 → 分散失效）下 VaR 放大，常態 VaR 看不到的尾部。這是假設情境的機械後果，非預測會發生、非事件機率估計、非投資建議。",
      "parameters": {
        "type": "object",
        "properties": {
          "perAsset": { "type": "object", "description": "個股衝擊（代號→報酬小數），例如 {\"2330\": -0.2} 表 2330 跌 20%", "additionalProperties": { "type": "number" } },
          "perSector": { "type": "object", "description": "族群衝擊（族群名→報酬小數），例如 {\"半導體\": -0.15}", "additionalProperties": { "type": "number" } },
          "marketTW": { "type": "number", "description": "台股大盤衝擊（報酬小數），例如 -0.08 表 −8%" },
          "marketUS": { "type": "number", "description": "美股大盤衝擊（報酬小數），例如 -0.1 表 −10%（影響美股部位）" },
          "fxShock": { "type": "number", "description": "USD/TWD 衝擊（小數），例如 -0.05 表台幣升、美元 −5%（縮水美股部位 TWD 值）" },
          "volRegime": { "type": "string", "description": "波動 regime：normal | stress | crisis（放大 σ：1 / 1.6 / 2.5）" },
          "corrRegime": { "type": "string", "description": "相關性 regime：normal | breakdown（平均相關 0.35 / 0.92，崩潰時分散失效）" },
          "fxRate": { "type": "number", "description": "USD/TWD 匯率覆寫；不給則用 live 匯率（DB 快取 fallback）" }
        },
        "required": []
      }
    }
  }
];

const executors = {
  // 個股機率錐 — 直接餵 DB 日線給 GBM 引擎（route /api/predict/gbm 由 client 組 priceData + requireSameOrigin，
  // 故工具端自抓資料、共用同一顆引擎，與 _predictBacktestHandler 的取數一致）。
  async get_price_forecast(args = {}) {
    try {
      const code = String(args.code || '').trim();
      if (!code) return { available: false, error: 'code required' };
      const market = String(args.market || 'TW').toUpperCase();
      const daysAhead = Math.max(1, Math.min(20, Number(args.daysAhead) || 7));

      const database = require('../../database');
      const rows = database.getDailyPrices(code, 400, market) || [];
      if (rows.length < 30) {
        return { available: false, code, market, reason: '歷史資料不足（需 ≥30 個交易日）', n: rows.length };
      }
      // getDailyPrices 已 oldest→newest；映射成引擎欄位（同 _predictBacktestHandler）
      const priceData = rows.map((r) => ({
        close: Number(r.close_price), high: Number(r.high_price), low: Number(r.low_price),
        open: Number(r.open_price), volume: Number(r.volume), trade_date: r.trade_date,
      }));

      // chipData=null：機率錐由對數報酬的 mu/sigma 驅動，不依賴籌碼（籌碼只調 instSentiment 註記）
      const res = _engine().predict(priceData, null, daysAhead);
      if (!res || res.error || !Array.isArray(res.predictions)) {
        return { available: false, code, market, error: res?.error || 'engine_error' };
      }

      const forecast = res.predictions.map((p) => ({
        day: p.day,
        median: p.monteCarlo?.median ?? null,
        probUp: p.monteCarlo?.probUp ?? null,        // %（≈50 屬常態）
        bands: p.bands || [],                         // [{level:50/80/90, lower, upper}]
      }));

      return {
        available: true,
        code, market, daysAhead,
        asofDate: rows[rows.length - 1]?.trade_date || null,
        currentPrice: res.stockPrice ?? null,
        regime: res.regime ? { regime: res.regime.regime, confidence: res.regime.confidence } : null,
        volModel: res.monteCarlo?.params || null,     // {mu, sigma, muDaily, sigmaDaily}（年化/日）
        forecast,
        calibrationHint: '此模型在實際持股上的前瞻覆蓋率/方向命中，請用 get_forecast_calibration（同代號）查核。',
        // 對抗式審查 MINOR：regime/volModel.mu 是餵進機率錐的描述性狀態分類與漂移估計，非方向性看多/看空判斷——明標避免代理轉述成買賣訊號。
        compliance: '機率錐為蒙地卡羅模擬的不確定性範圍，非買賣建議；上漲機率接近 50% 屬常態，不代表方向判斷。regime（bull/bear/sideways）與 volModel.mu（漂移）僅為餵入模擬的描述性狀態分類與歷史估計，非看多/看空的方向性判斷。',
      };
    } catch (e) {
      return { available: false, error: `預測失敗: ${e.message}` };
    }
  },

  // 前瞻校準帳本 — 給 code 查單檔、不給回投組聚合（lib/stock-forecast 已含 disclaimer）
  async get_forecast_calibration(args = {}) {
    try {
      const sf = require('../../stock-forecast');
      const sinceDays = Number(args.sinceDays) > 0 ? Number(args.sinceDays) : 365;
      const code = args.code ? String(args.code).trim() : null;
      if (code) {
        const market = String(args.market || 'TW').toUpperCase();
        return sf.getScorecard({ code, market, sinceDays });
      }
      return sf.getAggregateScorecard({ sinceDays });
    } catch (e) {
      return { available: false, error: `校準查詢失敗: ${e.message}` };
    }
  },

  // 盤前脈絡 — 只讀（記錄帳本是 scheduler/UI 的職責，工具不寫入避免噪音）；TW only（lib 硬編 ^TWII）
  async get_preopen_context(args = {}) {
    try {
      const days = Math.min(2600, Math.max(250, Number(args.days) || 1500));
      const r = require('../../cross-market-lead').buildCrossMarketLeadLag({ days });
      if (!r || !r.available) return r;
      // 對抗式審查 BLOCKER：lib 回傳只有數值 R²、無免責字串；UI 從模板渲染免責，但 MCP 代理只看 JSON。
      // 此工具會吐方向性點估計（大盤點位 + P(漲)），必須在 payload 內帶描述性框架，否則代理可能轉述成買賣建議。
      return {
        ...r,
        compliance: '跨市場領先回歸的描述性「參考範圍」，非預測、非買賣建議。每筆均附 R² 解釋力；領先多為隔夜跳空的 catch-up、edge 有限，並行市場（日經/韓綜）已誠實降權。除息日另有機械拖累 footnote（exDivContext）。',
      };
    } catch (e) {
      return { available: false, error: `盤前脈絡計算失敗: ${e.message}` };
    }
  },

  // 情境壓力傳播 — 讀真持倉，回機械後果（lib/scenario 已含 compliance 欄位）
  async run_scenario(args = {}) {
    try {
      const scenario = {};
      if (args.perAsset && typeof args.perAsset === 'object') scenario.perAsset = args.perAsset;
      if (args.perSector && typeof args.perSector === 'object') scenario.perSector = args.perSector;
      const mTW = args.marketTW, mUS = args.marketUS;
      if (mTW != null || mUS != null) {
        scenario.market = {};
        if (mTW != null && Number.isFinite(Number(mTW))) scenario.market.TW = Number(mTW);
        if (mUS != null && Number.isFinite(Number(mUS))) scenario.market.US = Number(mUS);
      }
      if (args.fxShock != null && Number.isFinite(Number(args.fxShock))) scenario.fxShock = Number(args.fxShock);
      if (args.volRegime) scenario.volRegime = String(args.volRegime);
      if (args.corrRegime) scenario.corrRegime = String(args.corrRegime);

      const fxRate = Number(args.fxRate) > 0
        ? Number(args.fxRate)
        : await require('../../exchange-rate').resolveFxRateOrDefault(require('../../database').getDB());
      return require('../../scenario').runScenario(scenario, { fxRate });
    } catch (e) {
      return { available: false, error: `情境傳播失敗: ${e.message}` };
    }
  },
};

module.exports = { definitions, executors };
