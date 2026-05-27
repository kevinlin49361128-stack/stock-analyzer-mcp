// ============================================
// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
// MCP Profiles — runtime tool filtering
//
// 2026-05-18 Sprint B：給 MCP 啟動時加一個 "profile" 概念，讓 user 可以
// 透過 SAA_MCP_PROFILE 環境變數限制要 expose 哪些 tool。
//
// 設計動機：
//   有些 user 想把 SAA MCP 接給「我不完全信任」的 LLM client（公司用的 GPT
//   instance / shared Claude project 等）。他們希望 LLM 能查 portfolio
//   但「絕對不能下單 / 不能改 thesis / 不能刪 trade」。
//
// 目前 profile：
//   - default      = 全部 81+ tool（含 write）
//   - safe_readonly = 只 expose readOnlyHint:true 的 tool；write/destructive tool 全 skip
//
// 未來可加：
//   - lite_only    = 只 expose Lite tier 能用的 tool（給 demo 用）
//   - macro_focused = 只 expose macro / market tool（給總經分析師用）
// ============================================
'use strict';

const { isReadOnly } = require('./mcp-meta');

const PROFILES = {
  default: {
    description: '所有工具（含 write）— Claude Desktop 個人用',
    allowTool: () => true,
    allowResource: () => true,
  },
  safe_readonly: {
    description: '僅 read-only tool — 給不完全信任的 LLM client 或共享環境用',
    allowTool: (toolName) => isReadOnly(toolName),
    // Resources 都是 read-only by definition
    allowResource: () => true,
  },
};

/**
 * Resolve the active profile based on env var SAA_MCP_PROFILE
 * 不認得的 profile name → 預設 default + warn to stderr
 */
function resolveProfile(profileName) {
  const name = profileName || process.env.SAA_MCP_PROFILE || 'default';
  if (!PROFILES[name]) {
    process.stderr.write(
      `[mcp-profiles] Unknown profile '${name}', falling back to 'default'. ` +
      `Valid: ${Object.keys(PROFILES).join(', ')}\n`
    );
    return { name: 'default', ...PROFILES.default };
  }
  return { name, ...PROFILES[name] };
}

/**
 * Filter tool definitions through the active profile.
 * @returns {{ kept: Array, skipped: string[] }}
 */
function filterToolDefinitions(toolDefs, profile) {
  const kept = [];
  const skipped = [];
  for (const td of toolDefs) {
    const name = td.function?.name;
    if (!name) continue;
    if (profile.allowTool(name)) {
      kept.push(td);
    } else {
      skipped.push(name);
    }
  }
  return { kept, skipped };
}

function filterResources(resources, profile) {
  return resources.filter(r => profile.allowResource(r.uri));
}

module.exports = {
  PROFILES, resolveProfile, filterToolDefinitions, filterResources,
};
