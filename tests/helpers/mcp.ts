// ABOUTME: Test helper that wires an McpServer to a Client via InMemoryTransport.
// ABOUTME: Lets tool/resource/prompt tests invoke handlers through the real MCP protocol.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface TestPair {
  server: McpServer;
  client: Client;
  close: () => Promise<void>;
}

export async function createTestPair(
  register: (server: McpServer) => void,
): Promise<TestPair> {
  const server = new McpServer({ name: "nbp-api-test", version: "0.0.0" });
  register(server);

  const client = new Client({ name: "nbp-api-test-client", version: "0.0.0" });
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return {
    server,
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

export function getTextContent(result: unknown): string {
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new Error("expected result.content to be an array");
  }
  const first = content[0] as { type?: string; text?: string } | undefined;
  if (!first || first.type !== "text" || typeof first.text !== "string") {
    throw new Error("expected first content block to be text");
  }
  return first.text;
}
