// ABOUTME: createServer() factory — instantiates NbpApiClient and McpServer,
// ABOUTME: wires all tools, resources, and prompts, returns the unconnected server.

import { NbpApiClient } from "#/nbp-api.js";
import { registerPrompts } from "#/prompts.js";
import { registerResources } from "#/resources.js";
import { registerTools } from "#/tools/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";

interface PackageManifest {
  name: string;
  version: string;
}

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageManifest;

export function createServer(): McpServer {
  const client = new NbpApiClient();
  const server = new McpServer({
    name: manifest.name,
    version: manifest.version,
  });
  registerTools(server, client);
  registerResources(server, client);
  registerPrompts(server);
  return server;
}

export const SERVER_NAME = manifest.name;
export const SERVER_VERSION = manifest.version;
