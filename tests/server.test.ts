// ABOUTME: Tests for src/server.ts — verifies createServer() exposes the
// ABOUTME: full count of tools/resources/prompts and all expected tool names.

import { createServer } from "#/server.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

interface Wired {
  client: Client;
  close: () => Promise<void>;
}

async function connect(): Promise<Wired> {
  const server = createServer();
  const client = new Client({ name: "nbp-api-test-client", version: "0.0.0" });
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

let wired: Wired;

beforeEach(async () => {
  wired = await connect();
});

afterEach(async () => {
  await wired.close();
});

describe("createServer", () => {
  test("exposes exactly 11 tools", async () => {
    const result = await wired.client.listTools();
    expect(result.tools).toHaveLength(11);
  });

  test("exposes exactly 5 resources", async () => {
    const result = await wired.client.listResources();
    expect(result.resources).toHaveLength(5);
  });

  test("exposes exactly 4 prompts", async () => {
    const result = await wired.client.listPrompts();
    expect(result.prompts).toHaveLength(4);
  });

  test("tool names cover all 11 expected entries", async () => {
    const result = await wired.client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "list_currencies",
        "get_exchange_rate",
        "get_rate_history",
        "compare_currencies",
        "get_exchange_table",
        "get_bid_ask_rates",
        "convert_currency",
        "find_rate_extreme",
        "get_gold_price",
        "get_gold_price_history",
        "find_gold_price_extreme",
      ].sort(),
    );
  });
});
