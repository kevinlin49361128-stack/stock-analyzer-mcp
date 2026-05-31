# Scope of the MIT License

The MIT License (see `LICENSE`) applies to the contents of **this repository only** —
the MCP server shim source code (`mcp-server.js`, `lib/mcp-*.js`, `lib/ai-tools.js`,
`lib/ai-tools/**`), the build artifacts (`Dockerfile`, `package.json`), the
documentation, and the integration examples.

The MCP shim is a thin HTTP-to-stdio bridge — tool execution proxies via
`http://localhost:3000/api/*` to the Stock Analyzer desktop application's
embedded backend.

The **Stock Analyzer desktop application itself** is closed-source commercial
software with its own EULA — see https://stockanalyzer.tw for details. This MIT
license does **not** grant any rights to the desktop application, its UI, its
analysis engine, or its data assets.
