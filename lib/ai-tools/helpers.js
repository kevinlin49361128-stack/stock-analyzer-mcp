// ============================================
// Copyright (c) 2025-2026 Kevin Lin. All rights reserved.
// AI Tools — internal HTTP helpers + utilities
// ============================================

'use strict';

const fetch = require('node-fetch');

const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

async function callInternal(path, timeout = 15000) {
  try {
    const resp = await fetch(`${BASE}${path}`, { timeout });
    if (!resp.ok) return { error: `API returned ${resp.status}` };
    return await resp.json();
  } catch (e) {
    return { error: e.message };
  }
}

async function postInternal(path, body, timeout = 30000) {
  try {
    const resp = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      timeout,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { error: data.error || `API returned ${resp.status}` };
    return data;
  } catch (e) {
    return { error: e.message };
  }
}

async function putInternal(path, body, timeout = 15000) {
  try {
    const resp = await fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      timeout,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { error: data.error || `API returned ${resp.status}` };
    return data;
  } catch (e) {
    return { error: e.message };
  }
}

async function deleteInternal(path, timeout = 15000) {
  try {
    const resp = await fetch(`${BASE}${path}`, { method: 'DELETE', timeout });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { error: data.error || `API returned ${resp.status}` };
    return data;
  } catch (e) {
    return { error: e.message };
  }
}

// Normalise stock identifier — tools use code/stockId/stock_id interchangeably
function resolveCode(args) {
  return args.code || args.stockId || args.stock_id || '';
}

// ============================================
// 2026-05-16: Cross-tool executor registry
// 部分 tools（get_full_stock_analysis / create_analysis_workflow / get_market_overview）
// 需要呼叫其他 tools 的 executor。但 ai-tools.js → tools/*.js 是單向 require，
// 拆模組 (2026-05-10) 後 child modules 失去原本的 EXECUTORS 全域變數導致 ReferenceError。
//
// 解法：helpers.js 暴露一個 mutable `registry`，由 ai-tools.js 在 EXECUTORS 建好後
// 用 Object.assign 注入。child modules 直接 reference helpers.registry.<tool>(args)
// runtime 才查表，避開 require 循環時的快照問題。
// ============================================
const registry = {};

module.exports = {
  BASE, callInternal, postInternal, putInternal, deleteInternal, resolveCode, registry,
};
