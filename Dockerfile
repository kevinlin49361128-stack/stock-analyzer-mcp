# Stock Analyzer MCP server — Glama-compatible Dockerfile
# stdio-only, no Electron, no GUI. Tool execution requires the Stock Analyzer
# desktop app running locally on http://localhost:3000 (where the Express
# backend lives). This container is intended for MCP discovery / introspection.
FROM node:20-alpine

WORKDIR /app

# Install only the minimal runtime dependencies needed by the MCP shim itself:
#   - @modelcontextprotocol/sdk: stdio transport + server framework
#   - node-fetch v2: used by lib/ai-tools/helpers.js for HTTP calls to localhost:3000
# (zod comes in transitively via the MCP SDK)
#
# This deliberately excludes:
#   - better-sqlite3 / electron / electron-updater: not imported by the MCP code path
#   - express / node-cron / winston / pdfjs-dist: backend-only, not in MCP shim
#   - @fugle/marketdata: real-time WS, backend-only
RUN npm install --no-save --no-package-lock --omit=dev \
  @modelcontextprotocol/sdk@^1.29.0 \
  node-fetch@^2.7.0

# Copy the MCP shim source. Everything below is needed at import time:
COPY mcp-server.js ./
COPY lib/mcp-schema.js lib/mcp-meta.js lib/mcp-profiles.js lib/mcp-resources.js lib/ai-tools.js ./lib/
COPY lib/ai-tools ./lib/ai-tools

# stdio transport — server reads JSON-RPC from stdin, writes JSON-RPC to stdout.
# Any other stdout output would break the protocol; the shim is silent by design.
ENTRYPOINT ["node", "mcp-server.js"]
