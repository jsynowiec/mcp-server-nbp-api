#!/usr/bin/env node
// ABOUTME: CLI entry point. Connects createServer() to a STDIO transport and
// ABOUTME: logs startup to stderr (stdout is reserved for the MCP JSON-RPC stream).

import { createServer, SERVER_INFO } from "#/server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`${SERVER_INFO.name} v${SERVER_INFO.version} ready\n`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`fatal: ${message}\n`);
  process.exit(1);
});
