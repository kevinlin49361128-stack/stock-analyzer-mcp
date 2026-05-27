// ============================================
// Copyright (c) 2025-2026 Kevin Lin. Released under MIT — see LICENSE.
// Stock Analyzer AI — MCP Server
//
// 將所有 AI 工具暴露為 Model Context Protocol (MCP) server
// 讓 Claude Code / Claude Desktop / 任何 MCP 相容 Agent 直接存取台股/美股資料
//
// 使用方式：
//   node mcp-server.js          （stdio transport，給 Claude Desktop 用）
//   bin/saa-mcp                 （wrapper：自動用 SAA 內建 Electron Node runtime，
//                                  解決 better-sqlite3 ABI mismatch 問題）
//
// 目前只支援 stdio transport。HTTP/SSE 還沒實作（曾在 0.41 階段註過虛擬的 --http
// 參數，2026-05-17 移除避免誤導）。
//
// Claude Desktop 設定（~/.claude/claude_desktop_config.json）：
//   {
//     "mcpServers": {
//       "stock-analyzer": {
//         "command": "/path/to/SAA/bin/saa-mcp",
//         "env": { "PORT": "3000" }
//       }
//     }
//   }
// ============================================

'use strict';

const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { buildObjectSchema } = require('./lib/mcp-schema');
const { getAnnotations, getMeta } = require('./lib/mcp-meta');
const { resolveProfile, filterToolDefinitions, filterResources } = require('./lib/mcp-profiles');
const { buildResources, buildTemplateResources, toResourceContents } = require('./lib/mcp-resources');

// 確保 App server 已啟動（MCP server 需要呼叫內部 API）
const PORT = process.env.PORT || 3000;
process.env.BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const aiTools = require('./lib/ai-tools');

const SERVER_VERSION = '1.2.1';
// changelog:
//   1.2.1 (2026-05-21) — + saa://memory/{stockId} template resource (Investor Memory layer)
//   1.2.0 (2026-05-18, Sprint C) — + compare_investment_candidates / post_trade_review
//                                    / saa://system/info resource / tools_schema_version surface
//   1.1.0 (2026-05-18, Sprint B) — + Multi-Agent / Daily Briefing tools / 5 resources / safe_readonly profile
//   1.0.0 (2026-05-17) — initial stdio MCP

const server = new McpServer({
  name: 'stock-analyzer',
  version: SERVER_VERSION,
});

// ────────────────────────────────────────────────────────
// Profile gating（SAA_MCP_PROFILE env var）
// ────────────────────────────────────────────────────────
const profile = resolveProfile();
const allDefs = aiTools.getToolDefinitions();
const { kept: toolDefs, skipped } = filterToolDefinitions(allDefs, profile);

if (skipped.length > 0) {
  process.stderr.write(
    `[mcp-server] profile='${profile.name}' skipped ${skipped.length} write tools: ` +
    `${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? ', …' : ''}\n`
  );
}

// ────────────────────────────────────────────────────────
// Tools — registerTool (not .tool) so we can set annotations + _meta
// ────────────────────────────────────────────────────────
for (const toolDef of toolDefs) {
  const fn = toolDef.function;
  const zodSchema = buildObjectSchema(fn.parameters);

  server.registerTool(fn.name, {
    description: fn.description,
    inputSchema: zodSchema.shape,
    annotations: getAnnotations(fn.name),
    _meta: getMeta(fn.name),
  }, async (args) => {
    try {
      const result = await aiTools.executeTool(fn.name, args);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
        isError: !!result.error,
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  });
}

// ────────────────────────────────────────────────────────
// Resources — saa://portfolio / watchlist / thesis / market/today / reports/recent / system/info
// ────────────────────────────────────────────────────────
const allResources = buildResources(aiTools, {
  profileName: profile.name,
  serverVersion: SERVER_VERSION,
});
const resources = filterResources(allResources, profile);

for (const r of resources) {
  server.registerResource(r.name, r.uri, {
    title: r.title,
    description: r.description,
    mimeType: r.mimeType,
  }, async (uri) => {
    try {
      const data = await r.read();
      return toResourceContents(uri.toString(), data);
    } catch (err) {
      return toResourceContents(uri.toString(), { error: err.message });
    }
  });
}

// ────────────────────────────────────────────────────────
// Template resources — saa://memory/{stockId}（SAA 第一個 URI-template resource）
// 2026-05-21 Phase 2：Investor Memory 暴露給外部 agent
// ────────────────────────────────────────────────────────
for (const tr of buildTemplateResources()) {
  server.registerResource(
    tr.name,
    new ResourceTemplate(tr.uriTemplate, { list: undefined }),
    { title: tr.title, description: tr.description, mimeType: tr.mimeType },
    async (uri, variables) => {
      try {
        const data = await tr.read(variables);
        return toResourceContents(uri.toString(), data);
      } catch (err) {
        return toResourceContents(uri.toString(), { error: err.message });
      }
    }
  );
}

// ────────────────────────────────────────────────────────
// Start stdio transport
// ────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP server 在 stdio 模式不輸出任何東西到 stdout（會干擾 JSON-RPC）
}

main().catch(err => {
  process.stderr.write(`MCP server error: ${err.message}\n`);
  process.exit(1);
});
