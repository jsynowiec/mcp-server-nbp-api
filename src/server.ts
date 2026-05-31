// ABOUTME: createServer() factory — instantiates NbpApiClient and McpServer,
// ABOUTME: wires all tools, resources, and prompts, returns the unconnected server.

import { NbpApiClient } from "#/nbp-api.js";
import { registerPrompts } from "#/prompts.js";
import { registerResources } from "#/resources.js";
import { registerTools } from "#/tools/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";

export interface ServerInfo {
  name: string;
  version: string;
}

export const SERVER_INFO: ServerInfo = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as ServerInfo;

export function createServer(): McpServer {
  const client = new NbpApiClient();
  const server = new McpServer(SERVER_INFO);
  registerTools(server, client);
  registerResources(server, client);
  registerPrompts(server);
  return server;
}
