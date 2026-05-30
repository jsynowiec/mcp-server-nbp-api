// ABOUTME: Aggregates per-domain tool registrations into a single registerTools entry point.
// ABOUTME: src/server.ts uses this to wire all 11 tools onto the McpServer.

import type { NbpApiClient } from "#/nbp-api.js";
import { registerExchangeTools } from "#/tools/exchange.js";
import { registerGoldTools } from "#/tools/gold.js";
import { registerRateTools } from "#/tools/rates.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerTools(server: McpServer, client: NbpApiClient): void {
  registerRateTools(server, client);
  registerExchangeTools(server, client);
  registerGoldTools(server, client);
}
